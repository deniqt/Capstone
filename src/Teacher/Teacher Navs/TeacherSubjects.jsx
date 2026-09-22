import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate, useParams } from "react-router-dom";
import "./teacherSubjects.css"
import {
    createNotification
} from "../../Services/notificationService"

function TeacherSubjects(){
    const {studentID}=useParams();
    const [subjects,setSubjects]=useState([]);
    const [student, setStudent]=useState([]);
    const [title, setTitle] = useState("");
    const [allSubjects, setAllSubjects] = useState([]);
    const[selectedSubject, setSelectedSubject] = useState("");
    const [description, setDescription] = useState("");
    const [file, setFile] = useState(null);
    const navigate=useNavigate();
    const [showModal, setShowModal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    const [contentType, setContentType] = useState("Material");
    const [assignmentType, setAssignmentType] = useState("Homework");
    const [dueDate, setDueDate] = useState("");
    const [totalPoints, setTotalPoints] = useState("");

    const [showEditModal, setShowEditModal] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);

    const [editAssignmentType, setEditAssignmentType] = useState("");
    const [editDueDate, setEditDueDate] = useState("");
    const [editTotalPoints, setEditTotalPoints] = useState("");


    const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
    const [selectedAssignmentForGrading, setSelectedAssignmentForGrading] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(false);

    const [showGradeModal, setShowGradeModal] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState(null);

    const [score, setScore] = useState("");
    const [feedback, setFeedback] = useState("");
    const [isGrading, setIsGrading] = useState(false);
    const [submittedAssignments, setSubmittedAssignments] = useState({});

    
    useEffect(()=>{
        console.log("useEffect ran");
        LoadData();

    },[]);

    async function LoadData() {

            const { data, error } = await supabase
                .from("Material_Assignment")
                .select(`
                    ID,

                    Materials(
                        Material_ID,
                        Material_Name,
                        Material_URL,
                        Material_Description,
                        file_name,

                        users(
                            Name
                        ),

                        Subjects(
                            Subject_ID,
                            Subject_Name
                        ),

                        Assignments(
                            Assignment_ID,
                            Assignment_Type,
                            Due_Date,
                            Total_Points
                        )
                    )
                `)
                .eq("Student_ID", studentID);

            if (error) {
                console.log(error);
                return;
            }

            // -----------------------------
            // Check student's submissions
            // -----------------------------

            const { data: submissionData, error: submissionError } =
                await supabase
                    .from("Assignment_Submissions")
                    .select(`
                        Submission_ID,
                        Assignment_ID,
                        Student_ID
                    `)
                    .eq("Student_ID", studentID);

            if (submissionError) {
                console.log("SUBMISSION CHECK ERROR:", submissionError);
            } else {

                const submissionMap = {};

                submissionData.forEach(submission => {
                    submissionMap[submission.Assignment_ID] = true;
                });

                setSubmittedAssignments(submissionMap);
            }

            console.log(data);

            const grouped = data.reduce((acc, item) => {

                const subject = item.Materials.Subjects;

                const extension = item.Materials.file_name
                    .split(".")
                    .pop()
                    .toLowerCase();

                let type = "Others";

                if (["pdf"].includes(extension))
                    type = "PDF";

                else if (["mp4", "mov"].includes(extension))
                    type = "Video";

                else if (["png", "jpg", "jpeg"].includes(extension))
                    type = "Image";

                if (!acc[subject.Subject_ID]) {

                    acc[subject.Subject_ID] = {
                        Subject_ID: subject.Subject_ID,
                        Subject_Name: subject.Subject_Name,
                        fileTypes: {}
                    };

                }

                if (!acc[subject.Subject_ID].fileTypes[type]) {
                    acc[subject.Subject_ID].fileTypes[type] = [];
                }

                acc[subject.Subject_ID].fileTypes[type]
                    .push(item.Materials);

                return acc;

            }, {});

            setSubjects(Object.values(grouped));

            // Get student
            const { data: UserData, error: UserError } =
                await supabase
                    .from("users")
                    .select("*")
                    .eq("id", studentID)
                    .single();

            if (UserError) {
                return;
            }

            setStudent(UserData);

            // Get subjects
            const { data: subjectData, error: subjectError } =
                await supabase
                    .from("Subjects")
                    .select("*")
                    .order("Subject_Name");

            if (subjectError) {
                console.log(subjectError);
                return;
            }

            setAllSubjects(subjectData);

            if (subjectData.length > 0) {
                setSelectedSubject(subjectData[0].Subject_ID);
            }
        }

        
    function convertPHTimeToUTC(dateTimeLocal) {
        if (!dateTimeLocal) return null;

        const [date, time] = dateTimeLocal.split("T");

        return new Date(
            `${date}T${time}:00+08:00`
        ).toISOString();
    }

    async function uploadMaterial() {

            const { data: { user }, error } = await supabase.auth.getUser();

                console.log("AUTH USER:", user);
                console.log("AUTH ERROR:", error);

            // Prevent double upload
            if (isUploading) {
                return;
            }

            // --------------------------------
            // Validate ALL fields
            // --------------------------------

            if (
                !title.trim() ||
                !description.trim() ||
                !file ||
                !selectedSubject ||
                !contentType
            ) {
                alert("Fill up all fields.");
                return;
            }

            // Assignment-specific fields
            if (contentType === "Assignment") {

                if (
                    !assignmentType ||
                    !dueDate ||
                    !totalPoints
                ) {
                    alert("Fill up all fields.");
                    return;
                }

                if (Number(totalPoints) <= 0) {
                    alert("Fill up all fields.");
                    return;
                }
            }

            // Lock upload button
            setIsUploading(true);

            try {

                // --------------------------------
                // Get logged-in user
                // --------------------------------

                const {
                    data: { user },
                    error: authError
                } = await supabase.auth.getUser();

                if (authError || !user) {
                    console.log(authError);
                    return;
                }


                // --------------------------------
                // 1. Upload file
                // --------------------------------

                const fileName = `${Date.now()}-${file.name}`;

                const { error: uploadError } = await supabase.storage
                    .from("Material_Storage")
                    .upload(fileName, file);

                if (uploadError) {
                    console.log(uploadError);
                    alert("Failed to upload file.");
                    return;
                }


                // --------------------------------
                // Get public URL
                // --------------------------------

                const { data: urlData } = supabase.storage
                    .from("Material_Storage")
                    .getPublicUrl(fileName);


                // --------------------------------
                // 2. Get tutor
                // --------------------------------

                const {
                    data: tutor,
                    error: tutorError
                } = await supabase
                    .from("users")
                    .select("id")
                    .eq("auth_id", user.id)
                    .single();

                if (tutorError) {
                    console.log(tutorError);
                    alert("Unable to find tutor.");
                    return;
                }


                // --------------------------------
                // 3. Create Material
                // --------------------------------

                const {
                    data: material,
                    error: materialError
                } = await supabase
                    .from("Materials")
                    .insert({
                        Tutor_ID: tutor.id,
                        Subject_ID: selectedSubject,
                        Material_Name: title,
                        Material_Description: description,
                        Material_URL: urlData.publicUrl,
                        file_name: file.name
                    })
                    .select()
                    .single();

                if (materialError) {
                    console.log(materialError);
                    alert("Failed to create material.");
                    return;
                }


                // --------------------------------
                // 4. Assign material to student
                // --------------------------------

                const {
                    error: assignmentError
                } = await supabase

                    .from("Material_Assignment")

                    .insert({

                        Material_ID:
                            material.Material_ID,

                        Student_ID:
                            studentID

                    });


                if (assignmentError) {

                    console.log(
                        assignmentError
                    );

                    alert(
                        "Failed to assign material."
                    );

                    return;
                }


                // --------------------------------
                // 5. Create Assignment
                // --------------------------------

                let createdAssignment = null;


                if (
                    contentType === "Assignment"
                ) {

                    const {
                        data: assignment,
                        error: gradedAssignmentError
                    } = await supabase

                        .from("Assignments")

                        .insert({

                            Material_ID:
                                material.Material_ID,

                            Assignment_Type:
                                assignmentType,

                            Due_Date:
                                    convertPHTimeToUTC(dueDate),

                            Total_Points:
                                Number(totalPoints)

                        })

                        .select()

                        .single();


                    if (gradedAssignmentError) {

                        console.log(
                            gradedAssignmentError
                        );

                        alert(
                            "Failed to create assignment."
                        );

                        return;
                    }


                    createdAssignment =
                        assignment;

                }


                // --------------------------------
                // 6. CREATE NOTIFICATION
                // --------------------------------

                if (
                    contentType === "Assignment"
                ) {

                    await createNotification({

                        userId:
                            Number(studentID),

                        title:
                            "New Assignment",

                        message:
                            `${material.Material_Name} has been assigned to you.`,

                        type:
                            "Assignment",

                        relatedTable:
                            "Assignments",

                        relatedId:
                            createdAssignment.Assignment_ID,

                        actionUrl:
                            `/student/materials`

                    });

                } else {

                    await createNotification({

                        userId:
                            Number(studentID),

                        title:
                            "New Learning Material",

                        message:
                            `${material.Material_Name} has been assigned to you.`,

                        type:
                            "Material",

                        relatedTable:
                            "Materials",

                        relatedId:
                            material.Material_ID,

                        actionUrl:
                            `/student/materials`

                    });

                }


                // --------------------------------
                // Success
                // --------------------------------


                    console.log("CURRENT AUTH USER:", user);
                    console.log("CURRENT AUTH UUID:", user?.id);

                alert(
                    contentType === "Assignment"
                        ? "Assignment Uploaded!"
                        : "Material Uploaded!"
                );

                await LoadData();


                // --------------------------------
                // Reset form
                // --------------------------------

                setTitle("");
                setDescription("");
                setFile(null);

                setContentType("Material");
                setAssignmentType("Homework");
                setDueDate("");
                setTotalPoints("");

                setShowModal(false);

            } catch (error) {

                console.log(error);
                alert("Something went wrong.");

            } finally {

                // Unlock button
                setIsUploading(false);

            }
        }

        async function updateAssignment() {

            if (!editingAssignment) {
                return;
            }

            if (
                !editAssignmentType ||
                !editDueDate ||
                !editTotalPoints
            ) {
                alert("Fill up all fields.");
                return;
            }

            if (Number(editTotalPoints) <= 0) {
                alert("Fill up all fields.");
                return;
            }

            const { error } = await supabase
                .from("Assignments")
                .update({
                    Assignment_Type: editAssignmentType,
                    Due_Date: convertPHTimeToUTC(editDueDate),
                    Total_Points: Number(editTotalPoints),
                    Updated_At: new Date().toISOString()
                })
                .eq(
                    "Assignment_ID",
                    editingAssignment.Assignment_ID
                );

            if (error) {
                console.log(error);
                alert("Failed to update assignment.");
                return;
            }

            alert("Assignment updated!");

            setShowEditModal(false);
            setEditingAssignment(null);

            await LoadData();
        }
            
    function openEditAssignment(assignment) {

        setEditingAssignment(assignment);

        setEditAssignmentType(
            assignment.Assignment_Type
        );

        setEditDueDate(
            assignment.Due_Date
                ? assignment.Due_Date.slice(0, 16)
                : ""
        );

        setEditTotalPoints(
            assignment.Total_Points
        );

        setShowEditModal(true);
    }



    async function loadSubmissions(assignment) {

        setLoadingSubmissions(true);
        setSelectedAssignmentForGrading(assignment);

        const { data, error } = await supabase
            .from("Assignment_Submissions")
            .select(`
                Submission_ID,
                Assignment_ID,
                Student_ID,
                Submission_URL,
                file_name,
                Submitted_At,
                Status,
                Score,
                Feedback,
                Graded_At,
                Is_Late
            `)
            .eq("Assignment_ID", assignment.Assignment_ID)
            .eq("Student_ID", studentID);

        if (error) {
            console.log("SUBMISSION ERROR:", error);
            alert("Failed to load submissions.");
            setLoadingSubmissions(false);
            return;
        }

        console.log("SUBMISSIONS:", data);

        setSubmissions(data || []);
        setShowSubmissionsModal(true);

        setLoadingSubmissions(false);
    }


    async function gradeSubmission() {

        if (isGrading) {
            return;
        }

        if (!selectedSubmission) {
            return;
        }

        if (
            score === "" ||
            Number(score) < 0
        ) {
            alert("Fill up all fields.");
            return;
        }

        const maxPoints =
            Number(
                selectedAssignmentForGrading.Total_Points
            );

        if (Number(score) > maxPoints) {
            alert(
                `Score cannot exceed ${maxPoints} points.`
            );
            return;
        }

        setIsGrading(true);

        try {

            const { error } = await supabase
                .from("Assignment_Submissions")
                .update({
                    Score: Number(score),
                    Feedback: feedback,
                    Graded_At: new Date().toISOString(),
                    Status: "Graded"
                })
                .eq(
                    "Submission_ID",
                    selectedSubmission.Submission_ID
                );

            if (error) {

                console.log(error);

                alert("Failed to save grade.");

                return;
            }

            await createNotification({

                userId: Number(studentID),

                title: "Assignment Graded",

                message:
                    `Your ${selectedAssignmentForGrading.Assignment_Type} has been graded. Score: ${score}/${selectedAssignmentForGrading.Total_Points}.`,

                type: "Grade",

                relatedTable:
                    "Assignment_Submissions",

                relatedId:
                    selectedSubmission.Submission_ID,

                actionUrl:
                    "/student/materials"

            });

            const {
                data: { user }
            } = await supabase.auth.getUser();

            console.log("CURRENT AUTH USER:", user);
            console.log("CURRENT AUTH UUID:", user?.id);

            alert("Grade saved successfully!");

            setShowGradeModal(false);
            setSelectedSubmission(null);

            setScore("");
            setFeedback("");

            // Reload submissions
            await loadSubmissions(
                selectedAssignmentForGrading
            );

        } catch (error) {

            console.log(error);

            alert("Something went wrong.");

        } finally {

            setIsGrading(false);

        }
    }

    return(

        

        <div className="subject-container">
            <h1>Files ni {student?.Name || "Unknown"}</h1>
            <button onClick={() => setShowModal(true)}>Upload File</button>

            {

              subjects.map(subject => (

                    <div
                        key={subject.Subject_ID}
                        className="subject-card"
                    >

                        <h2>📚 {subject.Subject_Name}</h2>

                        {Object.entries(subject.fileTypes).map(([type, materials]) => (

                            <div
                                key={type}
                                className="file-type-group"
                            >

                                <h3>{type}</h3>

                               {materials.map(material => {

                                        const assignment = material.Assignments?.[0];

                                        return (
                                            <div key={material.Material_ID}>

                                                {assignment ? (

                                                    <div className="assignment-card">

                                                        <h4>
                                                            📝 {material.Material_Name}
                                                        </h4>

                                                        <p>
                                                            Type: {assignment.Assignment_Type}
                                                        </p>

                                                        <p>
                                                            Due:{" "}
                                                            {new Date(
                                                                assignment.Due_Date
                                                            ).toLocaleString()}
                                                        </p>

                                                        <p>
                                                            Points: {assignment.Total_Points}
                                                        </p>

                                                        <a
                                                            href={material.Material_URL}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            📄 Open Assignment
                                                        </a>

                                                        <button
                                                            onClick={() =>
                                                                openEditAssignment(assignment)
                                                            }
                                                        >
                                                            ✏️ Edit Assignment
                                                        </button>

                                                        {submittedAssignments[assignment.Assignment_ID] && (
                                                            <button
                                                                onClick={() =>
                                                                    loadSubmissions(assignment)
                                                                }
                                                            >
                                                                👁️ View Submission
                                                            </button>
                                                        )}

                                                    </div>

                                                ) : (

                                                    <a
                                                        href={material.Material_URL}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        📄 {material.Material_Name}
                                                    </a>

                                                )}

                                            </div>
                                        );
                                    })}
                            </div>

                        ))}

                    </div>

                ))
            }



            {showModal && (
                <div className="modal-overlay">

                    <div className="modal">

                        <h2>Upload Material</h2>

                        <input
                            placeholder="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />

                        <textarea
                            placeholder="Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />

                        <input
                            type="file"
                            onChange={(e) => setFile(e.target.files[0])}
                        />

                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                        >

                            {allSubjects.map(subject => (

                                <option
                                    key={subject.Subject_ID}
                                    value={subject.Subject_ID}
                                >
                                    {subject.Subject_Name}
                                </option>

                            ))}

                        </select>


                        {/* CONTENT TYPE */}

                        <label>Content Type</label>

                        <select
                            value={contentType}
                            onChange={(e) => setContentType(e.target.value)}
                        >

                            <option value="Material">
                                Material
                            </option>

                            <option value="Assignment">
                                Assignment
                            </option>

                        </select>


                        {/* ASSIGNMENT OPTIONS */}

                        {contentType === "Assignment" && (

                            <div className="assignment-options">

                                <label>
                                    Assignment Type
                                </label>

                                <select
                                    value={assignmentType}
                                    onChange={(e) =>
                                        setAssignmentType(e.target.value)
                                    }
                                >

                                    <option value="Homework">
                                        Homework
                                    </option>

                                    <option value="Quiz">
                                        Quiz
                                    </option>

                                    <option value="Activity">
                                        Activity
                                    </option>

                                    <option value="Project">
                                        Project
                                    </option>

                                </select>


                                <label>
                                    Due Date
                                </label>

                                <input
                                    type="datetime-local"
                                    value={dueDate}
                                    onChange={(e) =>
                                        setDueDate(e.target.value)
                                    }
                                />


                                <label>
                                    Total Points
                                </label>

                                <input
                                    type="number"
                                    min="1"
                                    value={totalPoints}
                                    onChange={(e) =>
                                        setTotalPoints(e.target.value)
                                    }
                                    placeholder="e.g. 20"
                                />

                            </div>

                        )}


                       <button
                            onClick={uploadMaterial}
                            disabled={isUploading}
                        >
                            {isUploading ? "Uploading..." : "Upload"}
                        </button>

                        <button
                            onClick={() => setShowModal(false)}
                        >
                            Close
                        </button>

                    </div>

                </div>
            )}


            {showEditModal && (
                <div className="modal-overlay">

                    <div className="modal">

                        <h2>Edit Assignment</h2>

                        <label>
                            Assignment Type
                        </label>

                        <select
                            value={editAssignmentType}
                            onChange={(e) =>
                                setEditAssignmentType(
                                    e.target.value
                                )
                            }
                        >

                            <option value="Homework">
                                Homework
                            </option>

                            <option value="Quiz">
                                Quiz
                            </option>

                            <option value="Activity">
                                Activity
                            </option>

                            <option value="Project">
                                Project
                            </option>

                        </select>


                        <label>
                            Due Date
                        </label>

                        <input
                            type="datetime-local"
                            value={editDueDate}
                            onChange={(e) =>
                                setEditDueDate(
                                    e.target.value
                                )
                            }
                        />


                        <label>
                            Total Points
                        </label>

                        <input
                            type="number"
                            min="1"
                            value={editTotalPoints}
                            onChange={(e) =>
                                setEditTotalPoints(
                                    e.target.value
                                )
                            }
                        />


                        <button onClick={updateAssignment}>
                            Save Changes
                        </button>

                        <button
                            onClick={() => {
                                setShowEditModal(false);
                                setEditingAssignment(null);
                            }}
                        >
                            Cancel
                        </button>

                    </div>

                </div>
            )}


            {showSubmissionsModal && (

                <div className="modal-overlay">

                    <div className="modal">

                        <h2>
                            Student Submissions
                        </h2>

                        <h3>
                            {selectedAssignmentForGrading?.Assignment_Type}
                        </h3>

                        <p>
                            Total Points:{" "}
                            {selectedAssignmentForGrading?.Total_Points}
                        </p>


                        {loadingSubmissions ? (

                            <p>Loading submissions...</p>

                        ) : submissions.length === 0 ? (

                            <p>
                                No students have submitted yet.
                            </p>

                        ) : (

                            submissions.map(submission => (

                                <div
                                    key={submission.Submission_ID}
                                    className="submission-card"
                                >

                                    <h4>
                                        👤 {submission.users?.Name}
                                    </h4>

                                    <p>
                                        Status:{" "}
                                        {submission.Status}
                                    </p>

                                    <p>
                                        Submission:{" "}
                                        {submission.Is_Late
                                            ? "⚠️ Late"
                                            : "✅ On Time"}
                                    </p>

                                    <p>
                                        Submitted:{" "}
                                        {new Date(
                                            submission.Submitted_At
                                        ).toLocaleString()}
                                    </p>

                                    {submission.Submission_URL && (
                                        <a
                                            href={submission.Submission_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="submission-file-link"
                                        >
                                            📄 Open Student Submission
                                        </a>
                                    )}

                                    <p>
                                        Score:{" "}
                                        {submission.Score !== null &&
                                        submission.Score !== undefined
                                            ? `${submission.Score} / ${selectedAssignmentForGrading.Total_Points}`
                                            : "Not graded"}
                                    </p>

                                    <button
                                        onClick={() => {
                                            setSelectedSubmission(
                                                submission
                                            );

                                            setScore(
                                                submission.Score ?? ""
                                            );

                                            setFeedback(
                                                submission.Feedback ?? ""
                                            );

                                            setShowGradeModal(true);
                                        }}
                                    >
                                        {submission.Score !== null &&
                                        submission.Score !== undefined
                                            ? "✏️ Edit Grade"
                                            : "📝 Grade"}
                                    </button>

                                </div>

                            ))

                        )}


                        <button
                            onClick={() => {
                                setShowSubmissionsModal(false);
                                setSelectedAssignmentForGrading(null);
                                setSubmissions([]);
                            }}
                        >
                            Close
                        </button>

                    </div>

                </div>

            )}

            {showGradeModal && (

                <div className="modal-overlay">

                    <div className="modal">

                        <h2>
                            Grade Submission
                        </h2>

                        <h3>
                            {selectedSubmission?.users?.Name}
                        </h3>

                        <p>
                            File:{" "}
                            {selectedSubmission?.file_name}
                        </p>

                        <p>
                            Status:{" "}
                            {selectedSubmission?.Status}
                        </p>

                        <p>
                            Submission:{" "}
                            {selectedSubmission?.Is_Late
                                ? "⚠️ Late"
                                : "✅ On Time"}
                        </p>

                        <p>
                            Submitted:{" "}
                            {selectedSubmission &&
                                new Date(
                                    selectedSubmission.Submitted_At
                                ).toLocaleString()}
                        </p>

                        <a
                            href={
                                selectedSubmission?.Submission_URL
                            }
                            target="_blank"
                            rel="noreferrer"
                        >
                            📄 Open Student Submission
                        </a>


                        <br />
                        <br />


                        <label>
                            Score
                        </label>

                        <input
                            type="number"
                            min="0"
                            max={
                                selectedAssignmentForGrading?.Total_Points
                            }
                            value={score}
                            onChange={(e) =>
                                setScore(e.target.value)
                            }
                            placeholder={
                                `Maximum: ${selectedAssignmentForGrading?.Total_Points}`
                            }
                        />


                        <label>
                            Feedback
                        </label>

                        <textarea
                            value={feedback}
                            onChange={(e) =>
                                setFeedback(e.target.value)
                            }
                            placeholder="Enter feedback for the student..."
                        />


                        <button
                            onClick={gradeSubmission}
                            disabled={isGrading}
                        >
                            {isGrading
                                ? "Saving..."
                                : "Save Grade"}
                        </button>


                        <button
                            onClick={() => {
                                setShowGradeModal(false);
                                setSelectedSubmission(null);
                                setScore("");
                                setFeedback("");
                            }}
                        >
                            Cancel
                        </button>

                    </div>

                </div>

            )}

        </div>

    );

}

export default TeacherSubjects;