import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate, useParams } from "react-router-dom";
import {
    FileText,
    Presentation,
    File,
    Film,
    Image,
    ClipboardList
} from "lucide-react";
import "./teacherSubjects.css";
import { createNotification } from "../../Services/notificationService";

// Icon + label per group (same look as StudentSubject)
const TYPE_META = {
    Assignments: { Icon: ClipboardList, color: "Green", label: "Assignment" },
    PDF: { Icon: FileText, color: "red", label: "PDF" },
    PowerPoint: { Icon: Presentation, color: "Goldenrod", label: "Power Point" },
    Video: { Icon: Film, color: "Purple", label: "Video Recording" },
    Image: { Icon: Image, color: "Black", label: "Image" },
    Word: { Icon: File, color: "Blue", label: "Document" }
};

function TypeTitle({ type, text }) {
    const meta = TYPE_META[type];
    if (!meta) return <>📁 {text ?? type}</>;
    const { Icon, color, label } = meta;
    return (
        <div className="Type-Title">
            <Icon color={color} className="Type-Logo" /> {text ?? label}
        </div>
    );
}

function getGroupType(material, assignment) {
    if (assignment) return "Assignments";

    const extension =
        material.file_name?.split(".").pop().toLowerCase() || "";

    if (extension === "pdf") return "PDF";
    if (["mp4", "mov", "avi", "mkv"].includes(extension)) return "Video";
    if (["png", "jpg", "jpeg"].includes(extension)) return "Image";
    if (["doc", "docx"].includes(extension)) return "Word";
    if (["ppt", "pptx"].includes(extension)) return "PowerPoint";
    return "Others";
}

function TeacherSubjects() {
    const { studentID } = useParams();
    const navigate = useNavigate();

    const [subjects, setSubjects] = useState([]);
    const [student, setStudent] = useState([]);
    const [title, setTitle] = useState("");
    const [allSubjects, setAllSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [description, setDescription] = useState("");
    const [file, setFile] = useState(null);
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

    useEffect(() => {
        LoadData();
    }, []);

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
                    users(Name),
                    Subjects(Subject_ID, Subject_Name),
                    Assignments(Assignment_ID, Assignment_Type, Due_Date, Total_Points)
                )
            `)
            .eq("Student_ID", studentID);

        if (error) {
            console.log(error);
            return;
        }

        // Student's submissions
        const { data: submissionData, error: submissionError } = await supabase
            .from("Assignment_Submissions")
            .select(`Submission_ID, Assignment_ID, Student_ID`)
            .eq("Student_ID", studentID);

        if (submissionError) {
            console.log("SUBMISSION CHECK ERROR:", submissionError);
        } else {
            const submissionMap = {};
            submissionData.forEach(s => {
                submissionMap[s.Assignment_ID] = true;
            });
            setSubmittedAssignments(submissionMap);
        }

        // Group all files globally by category, regardless of subject.
        const grouped = data.reduce((acc, item) => {
            const material = item.Materials;
            if (!material) return acc;

            const assignment = material.Assignments?.[0];
            const type = getGroupType(material, assignment);

            if (!acc[type]) {
                acc[type] = [];
            }

            acc[type].push(material);
            return acc;
        }, {});

        // Keep the existing state shape so the total-material counter still works.
        setSubjects(
            Object.keys(grouped).length > 0
                ? [{ fileTypes: grouped }]
                : []
        );

        // Student
        const { data: UserData, error: UserError } = await supabase
            .from("users")
            .select("*")
            .eq("id", studentID)
            .single();

        if (UserError) return;
        setStudent(UserData);

        // Subjects
        const { data: subjectData, error: subjectError } = await supabase
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

    async function uploadMaterial() {
        if (isUploading) return;

        if (
            !title.trim() ||
            !description.trim() ||
            !file ||
            !contentType
        ) {
            alert("Fill up all fields.");
            return;
        }

        if (contentType === "Assignment") {
            if (!assignmentType || !dueDate || !totalPoints || Number(totalPoints) <= 0) {
                alert("Fill up all fields.");
                return;
            }
        }

        setIsUploading(true);

        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) {
                console.log(authError);
                return;
            }

            // 1. Upload file
            const fileName = `${Date.now()}-${file.name}`;

            const { error: uploadError } = await supabase.storage
                .from("Material_Storage")
                .upload(fileName, file);

            if (uploadError) {
                console.log(uploadError);
                alert("Failed to upload file.");
                return;
            }

            const { data: urlData } = supabase.storage
                .from("Material_Storage")
                .getPublicUrl(fileName);

            // 2. Tutor
            const { data: tutor, error: tutorError } = await supabase
                .from("users")
                .select("id")
                .eq("auth_id", user.id)
                .single();

            if (tutorError) {
                console.log(tutorError);
                alert("Unable to find tutor.");
                return;
            }

            // 3. Material
            const { data: material, error: materialError } = await supabase
                .from("Materials")
                .insert({
                    Tutor_ID: tutor.id,
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

            // 4. Assign to student
            const { error: assignmentError } = await supabase
                .from("Material_Assignment")
                .insert({
                    Material_ID: material.Material_ID,
                    Student_ID: studentID
                });

            if (assignmentError) {
                console.log(assignmentError);
                alert("Failed to assign material.");
                return;
            }

            // 5. Assignment
            let createdAssignment = null;

            if (contentType === "Assignment") {
                const { data: assignment, error: gradedAssignmentError } = await supabase
                    .from("Assignments")
                    .insert({
                        Material_ID: material.Material_ID,
                        Assignment_Type: assignmentType,
                        Due_Date: dueDate,
                        Total_Points: Number(totalPoints)
                    })
                    .select()
                    .single();

                if (gradedAssignmentError) {
                    console.log(gradedAssignmentError);
                    alert("Failed to create assignment.");
                    return;
                }

                createdAssignment = assignment;
            }

            // 6. Notification
            if (contentType === "Assignment") {
                await createNotification({
                    userId: Number(studentID),
                    title: "New Assignment",
                    message: `${material.Material_Name} has been assigned to you.`,
                    type: "Assignment",
                    relatedTable: "Assignments",
                    relatedId: createdAssignment.Assignment_ID,
                    actionUrl: `/student/materials`
                });
            } else {
                await createNotification({
                    userId: Number(studentID),
                    title: "New Learning Material",
                    message: `${material.Material_Name} has been assigned to you.`,
                    type: "Material",
                    relatedTable: "Materials",
                    relatedId: material.Material_ID,
                    actionUrl: `/student/materials`
                });
            }

            alert(
                contentType === "Assignment"
                    ? "Assignment Uploaded!"
                    : "Material Uploaded!"
            );

            await LoadData();

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
            setIsUploading(false);
        }
    }

    async function updateAssignment() {
        if (!editingAssignment) return;

        if (!editAssignmentType || !editDueDate || !editTotalPoints) {
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
                Due_Date: editDueDate,
                Total_Points: Number(editTotalPoints),
                Updated_At: new Date().toISOString()
            })
            .eq("Assignment_ID", editingAssignment.Assignment_ID);

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
        setEditAssignmentType(assignment.Assignment_Type);
        setEditDueDate(assignment.Due_Date ? assignment.Due_Date.slice(0, 16) : "");
        setEditTotalPoints(assignment.Total_Points);
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

        setSubmissions(data || []);
        setShowSubmissionsModal(true);
        setLoadingSubmissions(false);
    }

    async function gradeSubmission() {
        if (isGrading || !selectedSubmission) return;

        if (score === "" || Number(score) < 0) {
            alert("Fill up all fields.");
            return;
        }

        const maxPoints = Number(selectedAssignmentForGrading.Total_Points);

        if (Number(score) > maxPoints) {
            alert(`Score cannot exceed ${maxPoints} points.`);
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
                .eq("Submission_ID", selectedSubmission.Submission_ID);

            if (error) {
                console.log(error);
                alert("Failed to save grade.");
                return;
            }

            await createNotification({
                userId: Number(studentID),
                title: "Assignment Graded",
                message: `Your ${selectedAssignmentForGrading.Assignment_Type} has been graded. Score: ${score}/${selectedAssignmentForGrading.Total_Points}.`,
                type: "Grade",
                relatedTable: "Assignment_Submissions",
                relatedId: selectedSubmission.Submission_ID,
                actionUrl: "/student/materials"
            });

            alert("Grade saved successfully!");

            setShowGradeModal(false);
            setSelectedSubmission(null);
            setScore("");
            setFeedback("");

            await loadSubmissions(selectedAssignmentForGrading);

        } catch (error) {
            console.log(error);
            alert("Something went wrong.");
        } finally {
            setIsGrading(false);
        }
    }

    const assignmentOptions = (
        <>
            <option value="Homework">Homework</option>
            <option value="Quiz">Quiz</option>
            <option value="Activity">Activity</option>
            <option value="Project">Project</option>
        </>
    );

    const totalMaterials = subjects.reduce(
        (total, subject) =>
            total +
            Object.values(subject.fileTypes).reduce(
                (sum, files) => sum + files.length,
                0
            ),
        0
    );

    return (
        <div className="teacher-subject-container">

            {/* Breadcrumb */}
            <div className="breadcrumb">
                <button onClick={() => navigate(-1)}>Students</button>
                <span>›</span>
                <span>{student?.Name || "Unknown"}</span>
            </div>

            {/* Header */}
            <div className="teacher-header">
                <div>
                    <h1>📚 Files ni {student?.Name || "Unknown"}</h1>
                    <p>{totalMaterials} materials</p>
                </div>

                <button className="btn-primary" onClick={() => setShowModal(true)}>
                    Upload File
                </button>
            </div>

            {subjects.length === 0 && (
                <div className="empty-state">
                    No files yet. Upload a material or assignment to get started.
                </div>
            )}

            {subjects.length > 0 && (
                <div className="teacher-subject-section">
                    {Object.entries(subjects[0].fileTypes).map(([type, materials]) => (
                        <div key={type} className="material-type-section">
                            <h3><TypeTitle type={type} /></h3>

                            {materials.map(material => {
                                const assignment = material.Assignments?.[0];

                                return (
                                    <div
                                        key={material.Material_ID}
                                        className="material-list-card"
                                    >
                                        <div>
                                            <h4>
                                                <TypeTitle
                                                    type={type}
                                                    text={material.Material_Name}
                                                />
                                            </h4>

                                            <p>
                                                Subject: {material.Subjects?.Subject_Name || "Unknown Subject"}
                                            </p>

                                            {assignment ? (
                                                <p>
                                                    {assignment.Assignment_Type}
                                                    {" • "}
                                                    Due:{" "}
                                                    {assignment.Due_Date
                                                        ? new Date(assignment.Due_Date).toLocaleString()
                                                        : "No due date"}
                                                    {" • "}
                                                    {assignment.Total_Points} points
                                                </p>
                                            ) : (
                                                <p>{material.Material_Description}</p>
                                            )}
                                        </div>

                                        <div className="material-actions">
                                            <a
                                                href={material.Material_URL}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                <button className="btn-secondary btn-small">
                                                    Open
                                                </button>
                                            </a>

                                            {assignment && (
                                                <button
                                                    className="btn-secondary btn-small"
                                                    onClick={() => openEditAssignment(assignment)}
                                                >
                                                    ✏️ Edit
                                                </button>
                                            )}

                                            {assignment &&
                                                submittedAssignments[assignment.Assignment_ID] && (
                                                    <button
                                                        className="btn-primary btn-small"
                                                        onClick={() => loadSubmissions(assignment)}
                                                    >
                                                        👁️ View Submission
                                                    </button>
                                                )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}

            {/* UPLOAD MODAL */}
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


                        <label>Content Type</label>
                        <select
                            value={contentType}
                            onChange={(e) => setContentType(e.target.value)}
                        >
                            <option value="Material">Material</option>
                            <option value="Assignment">Assignment</option>
                        </select>

                        {contentType === "Assignment" && (
                            <div className="assignment-options">
                                <label>Assignment Type</label>
                                <select
                                    value={assignmentType}
                                    onChange={(e) => setAssignmentType(e.target.value)}
                                >
                                    {assignmentOptions}
                                </select>

                                <label>Due Date</label>
                                <input
                                    type="datetime-local"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                />

                                <label>Total Points</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={totalPoints}
                                    onChange={(e) => setTotalPoints(e.target.value)}
                                    placeholder="e.g. 20"
                                />
                            </div>
                        )}

                        <div className="modal-buttons">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowModal(false)}
                            >
                                Close
                            </button>
                            <button
                                className="btn-primary"
                                onClick={uploadMaterial}
                                disabled={isUploading}
                            >
                                {isUploading ? "Uploading..." : "Upload"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {showEditModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Edit Assignment</h2>

                        <label>Assignment Type</label>
                        <select
                            value={editAssignmentType}
                            onChange={(e) => setEditAssignmentType(e.target.value)}
                        >
                            {assignmentOptions}
                        </select>

                        <label>Due Date</label>
                        <input
                            type="datetime-local"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                        />

                        <label>Total Points</label>
                        <input
                            type="number"
                            min="1"
                            value={editTotalPoints}
                            onChange={(e) => setEditTotalPoints(e.target.value)}
                        />

                        <div className="modal-buttons">
                            <button
                                className="btn-secondary"
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingAssignment(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button className="btn-primary" onClick={updateAssignment}>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SUBMISSIONS MODAL */}
            {showSubmissionsModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Student Submissions</h2>

                        <h3>{selectedAssignmentForGrading?.Assignment_Type}</h3>

                        <p>Total Points: {selectedAssignmentForGrading?.Total_Points}</p>

                        {loadingSubmissions ? (
                            <p>Loading submissions...</p>
                        ) : submissions.length === 0 ? (
                            <p>No students have submitted yet.</p>
                        ) : (
                            submissions.map(submission => (
                                <div
                                    key={submission.Submission_ID}
                                    className="submission-card"
                                >
                                    <h4>👤 {student?.Name}</h4>

                                    <p>Status: {submission.Status}</p>

                                    <p>
                                        Submission:{" "}
                                        {submission.Is_Late ? "⚠️ Late" : "✅ On Time"}
                                    </p>

                                    <p>
                                        Submitted:{" "}
                                        {new Date(submission.Submitted_At).toLocaleString()}
                                    </p>

                                    {submission.Submission_URL && (
                                        <a
                                            href={submission.Submission_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
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
                                        className="btn-primary btn-small"
                                        onClick={() => {
                                            setSelectedSubmission(submission);
                                            setScore(submission.Score ?? "");
                                            setFeedback(submission.Feedback ?? "");
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

                        <div className="modal-buttons">
                            <button
                                className="btn-secondary"
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
                </div>
            )}

            {/* GRADE MODAL */}
            {showGradeModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Grade Submission</h2>

                        <h3>{student?.Name}</h3>

                        <p>File: {selectedSubmission?.file_name}</p>
                        <p>Status: {selectedSubmission?.Status}</p>
                        <p>
                            Submission:{" "}
                            {selectedSubmission?.Is_Late ? "⚠️ Late" : "✅ On Time"}
                        </p>
                        <p>
                            Submitted:{" "}
                            {selectedSubmission &&
                                new Date(selectedSubmission.Submitted_At).toLocaleString()}
                        </p>

                        <a
                            href={selectedSubmission?.Submission_URL}
                            target="_blank"
                            rel="noreferrer"
                        >
                            📄 Open Student Submission
                        </a>

                        <label>Score</label>
                        <input
                            type="number"
                            min="0"
                            max={selectedAssignmentForGrading?.Total_Points}
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                            placeholder={`Maximum: ${selectedAssignmentForGrading?.Total_Points}`}
                        />

                        <label>Feedback</label>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Enter feedback for the student..."
                        />

                        <div className="modal-buttons">
                            <button
                                className="btn-secondary"
                                onClick={() => {
                                    setShowGradeModal(false);
                                    setSelectedSubmission(null);
                                    setScore("");
                                    setFeedback("");
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={gradeSubmission}
                                disabled={isGrading}
                            >
                                {isGrading ? "Saving..." : "Save Grade"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TeacherSubjects;