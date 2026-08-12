import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate, useParams } from "react-router-dom";
import './studentMaterial.css'

function StudentAssignment() {

    const { assignmentID } = useParams();

    const navigate = useNavigate();


    const [assignment, setAssignment] = useState(null);
    const [submission, setSubmission] = useState(null);

    const [loading, setLoading] = useState(true);

    const [submissionFile, setSubmissionFile] = useState(null);

    const [isSubmitting, setIsSubmitting] = useState(false);


    useEffect(() => {

        loadAssignment();

    }, [assignmentID]);


    async function loadAssignment() {

        setLoading(true);

        try {

            // --------------------------------
            // Logged in user
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
            // Student
            // --------------------------------

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


            // --------------------------------
            // Assignment
            // --------------------------------

            const {
                data: assignmentData,
                error: assignmentError
            } = await supabase
                .from("Assignments")
                .select(`
                    Assignment_ID,
                    Assignment_Type,
                    Due_Date,
                    Total_Points,

                    Materials(
                        Material_ID,
                        Material_Name,
                        Material_URL,
                        Material_Description,

                        Subjects(
                            Subject_ID,
                            Subject_Name
                        )
                    )
                `)
                .eq(
                    "Assignment_ID",
                    assignmentID
                )
                .single();


            if (assignmentError) {

                console.log(assignmentError);

                return;

            }


            setAssignment(
                assignmentData
            );


            // --------------------------------
            // Student submission
            // --------------------------------

            const {
                data: submissionData,
                error: submissionError
            } = await supabase
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
                    Graded_At,
                    Is_Late
                `)
                .eq(
                    "Assignment_ID",
                    assignmentID
                )
                .eq(
                    "Student_ID",
                    student.id
                )
                .maybeSingle();


            if (submissionError) {

                console.log(submissionError);

                return;

            }


            setSubmission(
                submissionData
            );

        } catch (error) {

            console.log(error);

        } finally {

            setLoading(false);

        }

    }


    async function submitAssignment() {

        if (isSubmitting) {
            return;
        }


        if (!submissionFile) {

            alert("Fill up all fields.");

            return;

        }


        setIsSubmitting(true);


        try {

            // --------------------------------
            // Logged in user
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
            // Student
            // --------------------------------

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


            // --------------------------------
            // Prevent duplicate submission
            // --------------------------------

            const {
                data: existingSubmission,
                error: existingError
            } = await supabase
                .from("Assignment_Submissions")
                .select("Submission_ID")
                .eq(
                    "Assignment_ID",
                    assignmentID
                )
                .eq(
                    "Student_ID",
                    student.id
                )
                .maybeSingle();


            if (existingError) {

                console.log(existingError);

                alert(
                    "Unable to check previous submission."
                );

                return;

            }


            if (existingSubmission) {

                alert(
                    "You have already submitted this assignment."
                );

                return;

            }


            // --------------------------------
            // Is Late
            // --------------------------------

            const now = new Date();

            const dueDate =
                new Date(
                    assignment.Due_Date
                );

            const isLate =
                now > dueDate;


            // --------------------------------
            // Upload
            // --------------------------------

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

                alert(
                    "Failed to upload submission."
                );

                return;

            }


            // --------------------------------
            // Public URL
            // --------------------------------

            const {
                data: urlData
            } = supabase.storage
                .from("Material_Storage")
                .getPublicUrl(
                    fileName
                );


            // --------------------------------
            // Save
            // --------------------------------

            const {
                error: submissionError
            } = await supabase
                .from("Assignment_Submissions")
                .insert({

                    Assignment_ID:
                        assignmentID,

                    Student_ID:
                        student.id,

                    Submission_URL:
                        urlData.publicUrl,

                    file_name:
                        submissionFile.name,

                    Submitted_At:
                        new Date().toISOString(),

                    Status:
                        "Submitted",

                    Is_Late:
                        isLate

                });


            if (submissionError) {

                console.log(submissionError);

                alert(
                    "Failed to submit assignment."
                );

                return;

            }


            alert(
                isLate
                    ? "Assignment submitted late."
                    : "Assignment submitted successfully!"
            );


            setSubmissionFile(null);


            await loadAssignment();


        } catch (error) {

            console.log(error);

            alert(
                "Something went wrong."
            );

        } finally {

            setIsSubmitting(false);

        }

    }


    if (loading) {

        return (
            <h2>
                Loading assignment...
            </h2>
        );

    }


    if (!assignment) {

        return (
            <h2>
                Assignment not found.
            </h2>
        );

    }


    const material =
        assignment.Materials;


    const subject =
        material?.Subjects;


    return (

        <div className="student-assignment-container">


            {/* Breadcrumb */}

            <div className="breadcrumb">

                <button
                    onClick={() =>
                        navigate(
                            "/student/materials"
                        )
                    }
                >
                    Materials
                </button>

                <span>
                    ›
                </span>

                <button
                    onClick={() =>
                        navigate(
                            `/student/materials/subject/${subject?.Subject_ID}`
                        )
                    }
                >
                    {subject?.Subject_Name}
                </button>

                <span>
                    ›
                </span>

                <span>
                    Assignment
                </span>

            </div>


            {/* Header */}

            <div className="assignment-header">

                <div>

                    <h1>
                        📝 {material?.Material_Name}
                    </h1>

                    <p>
                        {assignment.Assignment_Type}
                    </p>

                </div>


                <div className="assignment-status">

                    {submission ? (

                        submission.Status === "Graded"

                            ? "🎓 Graded"

                            : submission.Is_Late
                                ? "⚠️ Submitted Late"
                                : "🔵 Submitted"

                    ) : (

                        "🟠 Pending"

                    )}

                </div>

            </div>


            {/* Main Grid */}

            <div className="assignment-grid">


                {/* Details */}

                <div className="assignment-panel">

                    <h2>
                        Details
                    </h2>

                    <p>
                        <strong>
                            Due Date
                        </strong>
                    </p>

                    <p>
                        {new Date(
                            assignment.Due_Date
                        ).toLocaleString()}
                    </p>


                    <p>
                        <strong>
                            Points
                        </strong>
                    </p>

                    <p>
                        {assignment.Total_Points} pts
                    </p>

                </div>


                {/* Instructions */}

                <div className="assignment-panel">

                    <h2>
                        Instructions
                    </h2>

                    <p>
                        {material?.Material_Description ||
                            "No instructions provided."}
                    </p>

                </div>


                {/* Reference Material */}

                <div className="assignment-panel">

                    <h2>
                        Reference Material
                    </h2>


                    {material?.Material_URL && (

                        <a
                            href={
                                material.Material_URL
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            📄 {material.Material_Name}
                        </a>

                    )}

                </div>


                {/* Submission */}

                <div className="assignment-panel">

                    <h2>
                        Submit Work
                    </h2>


                    {!submission ? (

                        <>

                            <input
                                type="file"
                                onChange={(e) =>
                                    setSubmissionFile(
                                        e.target.files[0]
                                    )
                                }
                            />


                            <button
                                onClick={
                                    submitAssignment
                                }
                                disabled={
                                    isSubmitting
                                }
                            >
                                {isSubmitting
                                    ? "Submitting..."
                                    : "Submit Assignment"}
                            </button>

                        </>

                    ) : (

                        <div>

                            <h3>
                                {submission.Status === "Graded"
                                    ? "🎓 Graded"
                                    : "✅ Submitted"}
                            </h3>


                            {submission.Is_Late && (

                                <p>
                                    ⚠️ Submitted Late
                                </p>

                            )}


                            <p>
                                Submitted:
                            </p>

                            <p>
                                {new Date(
                                    submission.Submitted_At
                                ).toLocaleString()}
                            </p>


                            {submission.Submission_URL && (

                                <a
                                    href={
                                        submission.Submission_URL
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    📄 View My Submission
                                </a>

                            )}


                            {/* Grade */}

                            {submission.Score !== null &&
                            submission.Score !== undefined ? (

                                <div className="grade-result">

                                    <h3>
                                        🎯 Your Score
                                    </h3>

                                    <p>

                                        <strong>
                                            {submission.Score}
                                        </strong>

                                        {" / "}

                                        {
                                            assignment.Total_Points
                                        }

                                    </p>


                                    {submission.Feedback && (

                                        <div>

                                            <h3>
                                                💬 Tutor Feedback
                                            </h3>

                                            <p>
                                                {
                                                    submission.Feedback
                                                }
                                            </p>

                                        </div>

                                    )}


                                    {submission.Graded_At && (

                                        <p>

                                            Graded:

                                            {" "}

                                            {new Date(
                                                submission.Graded_At
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

                    )}

                </div>

            </div>

        </div>

    );

}

export default StudentAssignment;