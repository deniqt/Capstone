
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./studentProgress.css";

function StudentProgress() {
    const [overallGrade, setOverallGrade] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tutorName, setTutorName] = useState("");
    const [evaluations, setEvaluations] = useState([]);

    useEffect(() => {
        loadProgress();
    }, []);

    async function loadProgress() {
        setLoading(true);

        try {
            // Get logged-in student
            const {
                data: { user },
                error: authError
            } = await supabase.auth.getUser();

            if (authError || !user) {
                console.error(authError || "No authenticated user found.");
                return;
            }

            // Get student account
            const {
                data: student,
                error: studentError
            } = await supabase
                .from("users")
                .select("id, Name, detail_id")
                .eq("auth_id", user.id)
                .single();

            if (studentError) {
                console.error(studentError);
                return;
            }

            // Get assigned tutor
            if (student.detail_id) {
                const {
                    data: studentDetails,
                    error: detailsError
                } = await supabase
                    .from("user_details")
                    .select("Tutor_ID")
                    .eq("detail_id", student.detail_id)
                    .maybeSingle();

                if (detailsError) {
                    console.error(detailsError);
                } else if (studentDetails?.Tutor_ID) {
                    const {
                        data: tutor,
                        error: tutorError
                    } = await supabase
                        .from("users")
                        .select("id, Name")
                        .eq("id", studentDetails.Tutor_ID)
                        .maybeSingle();

                    if (tutorError) {
                        console.error(tutorError);
                    } else {
                        setTutorName(tutor?.Name || "No tutor assigned");
                    }
                } else {
                    setTutorName("No tutor assigned");
                }
            }

            // Get all assignments assigned to this student
            const {
                data: assignedMaterials,
                error: assignmentError
            } = await supabase
                .from("Material_Assignment")
                .select(`
                    ID,
                    Materials(
                        Material_ID,
                        Material_Name,
                        Assignments(
                            Assignment_ID,
                            Assignment_Type,
                            Due_Date,
                            Total_Points
                        )
                    )
                `)
                .eq("Student_ID", student.id);

            if (assignmentError) {
                console.error(assignmentError);
                return;
            }

            // Get all student submissions
            const {
                data: submissions,
                error: submissionError
            } = await supabase
                .from("Assignment_Submissions")
                .select(`
                    Submission_ID,
                    Assignment_ID,
                    Score,
                    Status,
                    Submitted_At,
                    Graded_At,
                    Is_Late
                `)
                .eq("Student_ID", student.id);

            if (submissionError) {
                console.error(submissionError);
                return;
            }

            // Build one general list of assignments
            const submissionMap = new Map();

            (submissions || []).forEach((submission) => {
                const key = String(submission.Assignment_ID);
                const existing = submissionMap.get(key);

                // Keep the latest submission if duplicates exist
                if (
                    !existing ||
                    new Date(
                        submission.Submitted_At ||
                        submission.Graded_At ||
                        0
                    ) >= new Date(
                        existing.Submitted_At ||
                        existing.Graded_At ||
                        0
                    )
                ) {
                    submissionMap.set(key, submission);
                }
            });

            const evaluationList = [];

            (assignedMaterials || []).forEach((item) => {
                const material = item.Materials;

                if (!material) return;

                const materialAssignments = Array.isArray(
                    material.Assignments
                )
                    ? material.Assignments
                    : material.Assignments
                        ? [material.Assignments]
                        : [];

                materialAssignments.forEach((assignment) => {
                    if (!assignment?.Assignment_ID) return;

                    const submission = submissionMap.get(
                        String(assignment.Assignment_ID)
                    );

                    const score =
                        submission?.Score !== null &&
                        submission?.Score !== undefined
                            ? Number(submission.Score)
                            : null;

                    const totalPoints =
                        Number(assignment.Total_Points) || 0;

                    const isGraded =
                        score !== null &&
                        submission?.Graded_At != null;

                    evaluationList.push({
                        Assignment_ID: assignment.Assignment_ID,
                        Assignment_Name:
                            material.Material_Name || "Untitled Assignment",
                        Assignment_Type:
                            assignment.Assignment_Type || "Assignment",
                        Due_Date: assignment.Due_Date,
                        Total_Points: totalPoints,
                        Score: score,
                        Status: submission?.Status || "Pending",
                        Submitted_At: submission?.Submitted_At || null,
                        Graded_At: submission?.Graded_At || null,
                        Is_Late: submission?.Is_Late || false,
                        Is_Graded: isGraded
                    });
                });
            });

            // Show the most recent assignments first
            evaluationList.sort((a, b) => {
                const dateA = new Date(
                    a.Graded_At || a.Submitted_At || a.Due_Date || 0
                );

                const dateB = new Date(
                    b.Graded_At || b.Submitted_At || b.Due_Date || 0
                );

                return dateB - dateA;
            });

            // Calculate the overall grade using graded assignments only
            const gradedEvaluations = evaluationList.filter(
                (evaluation) =>
                    evaluation.Is_Graded &&
                    evaluation.Total_Points > 0
            );

            const totalScore = gradedEvaluations.reduce(
                (sum, evaluation) => sum + evaluation.Score,
                0
            );

            const totalPoints = gradedEvaluations.reduce(
                (sum, evaluation) => sum + evaluation.Total_Points,
                0
            );

            const calculatedGrade =
                totalPoints > 0
                    ? (totalScore / totalPoints) * 100
                    : 0;

            setOverallGrade(
                Math.round(calculatedGrade * 10) / 10
            );

            setEvaluations(evaluationList);
        } catch (error) {
            console.error("Error loading student progress:", error);
        } finally {
            setLoading(false);
        }
    }

    const gradedEvaluations = evaluations.filter(
        (evaluation) =>
            evaluation.Is_Graded &&
            evaluation.Total_Points > 0
    );

    const pendingEvaluations = evaluations.filter(
        (evaluation) => !evaluation.Is_Graded
    );

    const totalScore = gradedEvaluations.reduce(
        (sum, evaluation) => sum + evaluation.Score,
        0
    );

    const totalPoints = gradedEvaluations.reduce(
        (sum, evaluation) => sum + evaluation.Total_Points,
        0
    );

    function formatDate(date) {
        if (!date) return "—";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) return "—";

        return parsedDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    if (loading) {
        return (
            <div className="progress-loading">
                Loading progress...
            </div>
        );
    }

    return (
        <div className="student-progress-container">
            <div className="progress-header">
                <h1>Progress & Grades</h1>
                <p>👤 Tutor: {tutorName || "No tutor assigned"}</p>
            </div>

            <div className="progress-layout">
                {/* OVERALL PROGRESS */}
                <div className="subject-breakdown">

                    <div className="evaluations">
                        <h3>All Assignments</h3>

                        {evaluations.length === 0 ? (
                            <div className="empty-progress">
                                <h3>No assignments yet.</h3>
                                <p>
                                    Your assignments and grades will appear
                                    here once your tutor assigns work.
                                </p>
                            </div>
                        ) : (
                            <div className="evaluation-table">
                                <div className="evaluation-header">
                                    <span>DATE</span>
                                    <span>ASSIGNMENT</span>
                                    <span>SCORE</span>
                                </div>

                                {evaluations.map((evaluation) => (
                                    <div
                                        key={evaluation.Assignment_ID}
                                        className="evaluation-row"
                                    >
                                        <span>
                                            {formatDate(
                                                evaluation.Graded_At ||
                                                evaluation.Submitted_At ||
                                                evaluation.Due_Date
                                            )}
                                        </span>

                                        <div>
                                            <strong>
                                                {evaluation.Assignment_Name}
                                            </strong>

                                            <small>
                                                {evaluation.Assignment_Type}
                                            </small>

                                            <small>
                                                {evaluation.Is_Graded
                                                    ? "Graded"
                                                    : evaluation.Submitted_At
                                                        ? "Submitted — awaiting grade"
                                                        : "Not submitted"}
                                            </small>
                                        </div>

                                        <span>
                                            {evaluation.Is_Graded ? (
                                                <strong>
                                                    {evaluation.Score} /{" "}
                                                    {evaluation.Total_Points}
                                                </strong>
                                            ) : (
                                                <span className="pending-score">
                                                    — / {evaluation.Total_Points}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* OVERALL PERFORMANCE */}
                <div className="progress-overview">
                    <h3>Overview</h3>

                    <div className="overall-grade-card">
                        <span>Average Overall Grade</span>
                        <strong>{overallGrade}%</strong>
                        <p>Based on graded assignments</p>
                    </div>

                    <div className="performance-card">
                        <h3>Performance Highlights</h3>

                        <div className="highlight-item">
                            <span>GRADED ASSIGNMENTS</span>
                            <strong>{gradedEvaluations.length}</strong>
                        </div>

                        <div className="highlight-item">
                            <span>AWAITING GRADES</span>
                            <strong>{pendingEvaluations.length}</strong>
                        </div>

                        <div className="highlight-item">
                            <span>OVERALL POINTS</span>
                            <strong>
                                {totalScore} / {totalPoints}
                            </strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StudentProgress;
