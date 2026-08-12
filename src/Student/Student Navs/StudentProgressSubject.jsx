import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate, useParams } from "react-router-dom";
import "./studentProgress.css";

function StudentProgressSubject() {

    const { subjectID } = useParams();

    const navigate = useNavigate();

    const [subject, setSubject] = useState(null);
    const [evaluations, setEvaluations] = useState([]);
    const [loading, setLoading] = useState(true);


    useEffect(() => {

        loadSubjectProgress();

    }, [subjectID]);


    async function loadSubjectProgress() {

        setLoading(true);

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
            // Get student
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
            // Get assignments
            // --------------------------------

            const {
                data,
                error
            } = await supabase
                .from("Material_Assignment")
                .select(`
                    ID,

                    Materials(
                        Material_ID,
                        Material_Name,
                        Tutor_ID,

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


            // --------------------------------
            // Get submissions
            // --------------------------------

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
                console.log(submissionError);
                return;
            }


            // --------------------------------
            // Filter subject
            // --------------------------------

            const subjectMaterials =
                data.filter(item => {

                    return String(
                        item.Materials?.Subjects?.Subject_ID
                    ) === String(subjectID);

                });


            if (subjectMaterials.length === 0) {

                setSubject(null);
                setEvaluations([]);

                return;

            }


            const subjectInfo =
                subjectMaterials[0]
                    .Materials
                    .Subjects;


            setSubject(subjectInfo);


             // --------------------------------
            // retrieve tutor name
            // --------------------------------


            const tutorID =
                    subjectMaterials[0]
                        .Materials
                        .Tutor_ID;

                let tutorName = "Tutor";

                if (tutorID) {

                    const {
                        data: tutor,
                        error: tutorError
                    } = await supabase
                        .from("users")
                        .select("id, Name")
                        .eq("id", tutorID)
                        .single();

                    if (!tutorError && tutor) {
                        tutorName = tutor.Name;
                    }
                }

                setSubject({
                    ...subjectInfo,
                    Tutor_Name: tutorName
                });


            // --------------------------------
            // Build evaluations
            // --------------------------------

            const evaluationList = [];


            subjectMaterials.forEach(item => {

                const material = item.Materials;

                if (!material) {
                    return;
                }


                const assignment =
                    material.Assignments?.[0];


                if (!assignment) {
                    return;
                }


                const submission =
                    submissions.find(
                        sub =>
                            String(
                                sub.Assignment_ID
                            ) ===
                            String(
                                assignment.Assignment_ID
                            )
                    );


                evaluationList.push({

                    Assignment_ID:
                        assignment.Assignment_ID,

                    Assignment_Name:
                        material.Material_Name,

                    Assignment_Type:
                        assignment.Assignment_Type,

                    Due_Date:
                        assignment.Due_Date,

                    Total_Points:
                        assignment.Total_Points,

                    Score:
                        submission?.Score ?? null,

                    Status:
                        submission?.Status ?? "Pending",

                    Graded_At:
                        submission?.Graded_At ?? null,

                    Is_Late:
                        submission?.Is_Late ?? false

                });

            });


            // newest first

            evaluationList.sort(
                (a, b) =>
                    new Date(b.Graded_At || b.Due_Date) -
                    new Date(a.Graded_At || a.Due_Date)
            );


            setEvaluations(evaluationList);


        } catch (error) {

            console.log(error);

        } finally {

            setLoading(false);

        }

    }


    const gradedEvaluations =
        evaluations.filter(
            evaluation =>
                evaluation.Score !== null
        );


    let grade = 0;

    if (gradedEvaluations.length > 0) {

        const totalScore =
            gradedEvaluations.reduce(
                (sum, evaluation) =>
                    sum + Number(evaluation.Score),
                0
            );


        const totalPoints =
            gradedEvaluations.reduce(
                (sum, evaluation) =>
                    sum + Number(
                        evaluation.Total_Points
                    ),
                0
            );


        if (totalPoints > 0) {

            grade =
                Math.round(
                    (
                        totalScore /
                        totalPoints
                    ) * 1000
                ) / 10;

        }

    }


    if (loading) {

        return (
            <div className="progress-loading">
                Loading progress...
            </div>
        );

    }


    if (!subject) {

        return (

            <div className="empty-progress">

                <h2>
                    Subject not found
                </h2>

                <button
                    onClick={() =>
                        navigate("/student/progress")
                    }
                >
                    Back to Progress
                </button>

            </div>

        );

    }


    return (

        <div className="student-progress-container">


            {/* ================================= */}
            {/* BREADCRUMB */}
            {/* ================================= */}

            <div className="progress-breadcrumb">

                <button
                    onClick={() =>
                        navigate("/student/progress")
                    }
                >
                    Progress
                </button>

                <span>
                    ›
                </span>

                <span>
                    {subject.Subject_Name}
                </span>

            </div>


            <div className="progress-header">

                <h1>
                    Progress & Grades
                </h1>

            </div>


            <div className="progress-layout">


                {/* ================================= */}
                {/* LEFT */}
                {/* ================================= */}

                <div className="subject-detail">


                    <div className="subject-detail-header">

                        <div className="subject-icon">
                            📚
                        </div>


                        <div>

                            <h2>
                                {subject.Subject_Name}
                            </h2>

                           <p>
                                👤 {subject.Tutor_Name || "Tutor"}
                            </p>

                        </div>

                    </div>


                    <div className="subject-grade">

                        <span>
                            Grade
                        </span>

                        <strong>
                            {grade}%
                        </strong>

                    </div>


                    {/* ================================= */}
                    {/* RECENT EVALUATIONS */}
                    {/* ================================= */}

                    <div className="evaluations">

                        <h3>
                            Recent Evaluations
                        </h3>


                        {evaluations.length === 0 ? (

                            <p>
                                No evaluations yet.
                            </p>

                        ) : (

                            <div className="evaluation-table">


                                <div className="evaluation-header">

                                    <span>
                                        DATE
                                    </span>

                                    <span>
                                        ASSIGNMENT / EXAM
                                    </span>

                                    <span>
                                        SCORE
                                    </span>

                                </div>


                                {evaluations.map(
                                    evaluation => (

                                        <div
                                            key={
                                                evaluation.Assignment_ID
                                            }
                                            className="evaluation-row"
                                        >


                                            {/* Date */}

                                            <span>

                                                {
                                                    evaluation.Graded_At
                                                        ? new Date(
                                                            evaluation.Graded_At
                                                        ).toLocaleDateString(
                                                            "en-US",
                                                            {
                                                                month: "short",
                                                                day: "numeric",
                                                                year: "numeric"
                                                            }
                                                        )
                                                        : "—"
                                                }

                                            </span>


                                            {/* Assignment */}

                                            <div>

                                                <strong>
                                                    {
                                                        evaluation.Assignment_Name
                                                    }
                                                </strong>

                                                <small>
                                                    {
                                                        evaluation.Assignment_Type
                                                    }
                                                </small>

                                            </div>


                                            {/* Score */}

                                            <span>

                                                {evaluation.Score !== null ? (

                                                    <strong>

                                                        {
                                                            evaluation.Score
                                                        }

                                                        /

                                                        {
                                                            evaluation.Total_Points
                                                        }

                                                    </strong>

                                                ) : (

                                                    <span className="pending-score">
                                                        — / {
                                                            evaluation.Total_Points
                                                        }
                                                    </span>

                                                )}

                                            </span>


                                        </div>

                                    )
                                )}

                            </div>

                        )}

                    </div>

                </div>


                {/* ================================= */}
                {/* RIGHT */}
                {/* ================================= */}

                <div className="progress-overview">

                    <h3>
                        Overview
                    </h3>


                    <div className="overall-grade-card">

                        <span>
                            Average Grade
                        </span>

                        <strong>
                            {grade}%
                        </strong>

                        <p>
                            Based on graded evaluations
                        </p>

                    </div>


                    <div className="performance-card">

                        <h3>
                            Performance
                        </h3>

                        <div className="highlight-item">

                            <span>
                                EVALUATIONS
                            </span>

                            <strong>
                                {evaluations.length}
                            </strong>

                        </div>


                        <div className="highlight-item">

                            <span>
                                GRADED
                            </span>

                            <strong>
                                {gradedEvaluations.length}
                            </strong>

                        </div>


                        <div className="highlight-item">

                            <span>
                                PENDING
                            </span>

                            <strong>
                                {
                                    evaluations.length -
                                    gradedEvaluations.length
                                }
                            </strong>

                        </div>

                    </div>

                </div>

            </div>

        </div>

    );

}

export default StudentProgressSubject;