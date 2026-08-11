import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function StudentMaterial() {

    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showSubmissionModal, setShowSubmissionModal] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [submissionFile, setSubmissionFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadMaterials();
    }, []);

    async function loadMaterials() {

        // Logged in auth user
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        // Get student from users table
        const { data: student, error: studentError } = await supabase
            .from("users")
            .select("*")
            .eq("auth_id", user.id)
            .single();

        if (studentError) {
            console.log(studentError);
            return;
        }

        // Get assigned materials
        const { data, error } = await supabase
            .from("Material_Assignment")
            .select(`
                *,
                Materials(
                    *,
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
            .eq("Student_ID", student.id);

        if (error) {
            console.log(error);
            return;
        }
        console.log(data);


       const { data: submissions, error: submissionError } =
        await supabase
            .from("Assignment_Submissions")
            .select(`
                Submission_ID,
                Assignment_ID,
                Submission_URL,
                file_name,
                Submitted_At,
                Status,
                Score,
                Feedback,
                Graded_At
            `)
            .eq("Student_ID", student.id);


        if (submissionError) {
            console.log(submissionError);
            return;
        }


            const grouped = data.reduce((acc, item) => {

            const subject = item.Materials.Subjects;

            const extension = item.Materials.file_name
                ?.split(".")
                .pop()
                .toLowerCase() || "";

            let type = "Others";

            if (["pdf"].includes(extension))
                type = "PDF";
            else if (["mp4","mov","avi","mkv"].includes(extension))
                type = "Video";
            else if (["png","jpg","jpeg"].includes(extension))
                type = "Image";
            else if (["doc","docx"].includes(extension))
                type = "Word";
            else if (["ppt","pptx"].includes(extension))
                type = "PowerPoint";

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

           const assignment = item.Materials.Assignments?.[0];

            const submission = assignment
                ? submissions.find(
                    sub =>
                        sub.Assignment_ID ===
                        assignment.Assignment_ID
                )
                : null;

            acc[subject.Subject_ID].fileTypes[type].push({
                ...item.Materials,
                submission
            });

            return acc;

        }, {});

        setMaterials(Object.values(grouped));
        setLoading(false);
    }




    function openSubmissionModal(assignment, material) {

        setSelectedAssignment({
            ...assignment,
            Material_Name: material.Material_Name
        });

        setSubmissionFile(null);
        setShowSubmissionModal(true);
    }



    async function submitAssignment() {

            if (isSubmitting) {
                return;
            }

            if (!submissionFile) {
                alert("Fill up all fields.");
                return;
            }

            if (!selectedAssignment) {
                return;
            }

            setIsSubmitting(true);

            try {

                // -----------------------------
                // Get logged-in student
                // -----------------------------

                const {
                    data: { user },
                    error: authError
                } = await supabase.auth.getUser();

                if (authError || !user) {
                    console.log(authError);
                    return;
                }


                // -----------------------------
                // Get student
                // -----------------------------

                const {
                    data: student,
                    error: studentError
                } = await supabase
                    .from("users")
                    .select("id")
                    .eq("auth_id", user.id)
                    .single();

                if (studentError) {
                    console.log(studentError);
                    return;
                }


            const { data: existingSubmission, error: existingError } =
                    await supabase
                        .from("Assignment_Submissions")
                        .select("Submission_ID")
                        .eq(
                            "Assignment_ID",
                            selectedAssignment.Assignment_ID
                        )
                        .eq(
                            "Student_ID",
                            student.id
                        )
                        .maybeSingle();

                if (existingError) {
                    console.log(existingError);
                    alert("Unable to check previous submission.");
                    return;
                }

                if (existingSubmission) {
                    alert("You have already submitted this assignment.");
                    return;
                }


                // -----------------------------
                // Check due date
                // -----------------------------

                const now = new Date();
                const dueDate = new Date(
                    selectedAssignment.Due_Date
                );

                const isLate = now > dueDate;


                // -----------------------------
                // Upload answer file
                // -----------------------------

                const fileName =
                    `submission-${Date.now()}-${submissionFile.name}`;

                const {
                    error: uploadError
                } = await supabase.storage
                    .from("Material_Storage")
                    .upload(
                        fileName,
                        submissionFile
                    );

                if (uploadError) {
                    console.log(uploadError);
                    alert("Failed to upload submission.");
                    return;
                }


                // -----------------------------
                // Get public URL
                // -----------------------------

                const {
                    data: urlData
                } = supabase.storage
                    .from("Material_Storage")
                    .getPublicUrl(fileName);


                // -----------------------------
                // Save submission
                // -----------------------------

                const {
                    error: submissionError
                } = await supabase
                    .from("Assignment_Submissions")
                    .insert({
                        Assignment_ID:
                            selectedAssignment.Assignment_ID,

                        Student_ID:
                            student.id,

                        Submission_URL:
                            urlData.publicUrl,

                        file_name:
                            submissionFile.name,

                        Submitted_At:
                            new Date().toISOString(),

                        Status: "Submitted",
                        Is_Late: isLate
                    });

                if (submissionError) {
                    console.log(submissionError);
                    alert("Failed to submit assignment.");
                    return;
                }


              alert(
                    isLate
                        ? "Assignment submitted late."
                        : "Assignment submitted successfully!"
                );

               setSubmissionFile(null);
                setSelectedAssignment(null);
                setShowSubmissionModal(false);

                await loadMaterials();

            } catch (error) {

                console.log(error);
                alert("Something went wrong.");

            } finally {

                setIsSubmitting(false);

            }
        }


    if (loading)
        return <h2>Loading...</h2>;

    return (
        <>
            <h1>My Learning Materials</h1>

            {
                
                materials.length === 0 ?

                    <h3>No materials assigned yet.</h3>

                    :
                    
                    materials.map(subject => (

                        <div
                            key={subject.Subject_ID}
                            className="subject-card"
                        >

                            <h2>📚 {subject.Subject_Name}</h2>

                            {Object.entries(subject.fileTypes).map(([type, files]) => (

                                <div
                                    key={type}
                                    className="file-type-group"
                                >

                                    <h3>📁{type}</h3>

                                    {files.map(material => {

                                        const assignment = material.Assignments?.[0];

                                        return (

                                            <div
                                                key={material.Material_ID}
                                                className="material-card"
                                            >

                                                {assignment ? (

                                                    <>
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
                                                            rel="noopener noreferrer"
                                                        >
                                                            📄 Open Assignment
                                                        </a>

                                                        <br />

                                                        {material.submission ? (

                                                                <div className="submission-result">

                                                                    {/* Submission Status */}

                                                                    <p>
                                                                        {material.submission.Status === "Late"
                                                                            ? "⚠️ Submitted Late"
                                                                            : material.submission.Status === "Graded"
                                                                                ? "🎓 Graded"
                                                                                : "✅ Submitted"}
                                                                    </p>


                                                                    {/* Submission Date */}

                                                                    <p>
                                                                        Submitted:{" "}
                                                                        {new Date(
                                                                            material.submission.Submitted_At
                                                                        ).toLocaleString()}
                                                                    </p>


                                                                    {/* Open Student Submission */}

                                                                    {material.submission.Submission_URL && (

                                                                        <a
                                                                            href={material.submission.Submission_URL}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                        >
                                                                            📄 View My Submission
                                                                        </a>

                                                                    )}


                                                                    {/* Grade */}

                                                                    {material.submission.Score !== null &&
                                                                    material.submission.Score !== undefined ? (

                                                                        <div className="grade-result">

                                                                            <h4>
                                                                                🎯 Your Score
                                                                            </h4>

                                                                            <p>
                                                                                <strong>
                                                                                    {material.submission.Score}
                                                                                </strong>
                                                                                {" / "}
                                                                                {assignment.Total_Points}
                                                                            </p>


                                                                            {/* Feedback */}

                                                                            {material.submission.Feedback && (

                                                                                <div className="feedback">

                                                                                    <h4>
                                                                                        💬 Tutor Feedback
                                                                                    </h4>

                                                                                    <p>
                                                                                        {material.submission.Feedback}
                                                                                    </p>

                                                                                </div>

                                                                            )}


                                                                            {/* Graded Date */}

                                                                            {material.submission.Graded_At && (

                                                                                <p>
                                                                                    Graded:{" "}
                                                                                    {new Date(
                                                                                        material.submission.Graded_At
                                                                                    ).toLocaleString()}
                                                                                </p>

                                                                            )}

                                                                        </div>

                                                                    ) : (

                                                                        <p>
                                                                            ⏳ Waiting for tutor to grade your submission.
                                                                        </p>

                                                                    )}

                                                                </div>

                                                            ) : (

                                                                <button
                                                                    onClick={() =>
                                                                        openSubmissionModal(
                                                                            assignment,
                                                                            material
                                                                        )
                                                                    }
                                                                >
                                                                    Submit Assignment
                                                                </button>

                                                            )}

                                                    </>

                                                ) : (

                                                    <>
                                                        <h4>
                                                            {material.Material_Name}
                                                        </h4>

                                                        <a
                                                            href={material.Material_URL}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            Open Material
                                                        </a>
                                                    </>

                                                )}

                                            </div>

                                        );
                                    })}

                                </div>

                            ))}

                        </div>

                    ))
            }



            {showSubmissionModal && (

                <div className="modal-overlay">

                    <div className="modal">

                        <h2>
                            Submit Assignment
                        </h2>

                        <h3>
                            {selectedAssignment?.Material_Name}
                        </h3>

                        <p>
                            Due:{" "}
                            {selectedAssignment &&
                                new Date(
                                    selectedAssignment.Due_Date
                                ).toLocaleString()}
                        </p>

                        <p>
                            Total Points:{" "}
                            {selectedAssignment?.Total_Points}
                        </p>


                        <input
                            type="file"
                            onChange={(e) =>
                                setSubmissionFile(
                                    e.target.files[0]
                                )
                            }
                        />


                        <button
                            onClick={submitAssignment}
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? "Submitting..."
                                : "Submit Assignment"}
                        </button>


                        <button
                            onClick={() => {
                                setShowSubmissionModal(false);
                                setSelectedAssignment(null);
                                setSubmissionFile(null);
                            }}
                        >
                            Cancel
                        </button>

                    </div>

                </div>

            )}

        </>
    );
}

export default StudentMaterial;