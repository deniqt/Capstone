import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./studentProgress.css";

function StudentProgress() {

    const navigate = useNavigate();

    const [subjects, setSubjects] = useState([]);
    const [overallGrade, setOverallGrade] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tutorName, setTutorName] = useState("");

    useEffect(() => {
        loadProgress();
    }, []);


    async function loadProgress() {

        setLoading(true);

        try {

            // --------------------------------
            // Get logged-in student
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
                .select(`
                    id,
                    Name,
                    detail_id
                `)
                .eq("auth_id", user.id)
                .single();

            if (studentError) {
                console.log(studentError);
                return;
            }

            const {
                data: studentDetails,
                error: detailsError
            } = await supabase
                .from("user_details")
                .select(`
                    Tutor_ID
                `)
                .eq("detail_id", student.detail_id)
                .single();

            if (detailsError) {
                console.log(detailsError);
                return;
            }


            const {
                data: tutor,
                error: tutorError
            } = await supabase
                .from("users")
                .select(`
                    id,
                    Name
                `)
                .eq("id", studentDetails.Tutor_ID)
                .single();

            if (tutorError) {
                console.log(tutorError);
                return;
            }

            setTutorName(tutor.Name);

            // --------------------------------
            // Get assigned materials
            // --------------------------------

            const {
                data: assignments,
                error: assignmentError
            } = await supabase
                .from("Material_Assignment")
                .select(`
                    ID,

                    Materials(
                        Material_ID,

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


            if (assignmentError) {
                console.log(assignmentError);
                return;
            }


            // --------------------------------
            // Get student's submissions
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
            // Group assignments by subject
            // --------------------------------

            const subjectMap = {};


            assignments.forEach(item => {

                const material = item.Materials;

                if (!material) {
                    return;
                }

                const subject = material.Subjects;

                if (!subject) {
                    return;
                }

                const assignment =
                    material.Assignments?.[0];

                // Ignore normal materials
                if (!assignment) {
                    return;
                }


                if (!subjectMap[subject.Subject_ID]) {

                    subjectMap[subject.Subject_ID] = {

                        Subject_ID:
                            subject.Subject_ID,

                        Subject_Name:
                            subject.Subject_Name,

                        assignments: [],

                        gradedCount: 0,

                        totalScore: 0,

                        totalPoints: 0

                    };

                }


                const submission =
                    submissions.find(
                        sub =>
                            String(sub.Assignment_ID) ===
                            String(assignment.Assignment_ID)
                    );


                subjectMap[
                    subject.Subject_ID
                ].assignments.push({

                    ...assignment,

                    submission

                });


                // --------------------------------
                // Calculate grade
                // --------------------------------

                if (
                    submission &&
                    submission.Score !== null &&
                    submission.Score !== undefined
                ) {

                    subjectMap[
                        subject.Subject_ID
                    ].gradedCount++;

                    subjectMap[
                        subject.Subject_ID
                    ].totalScore +=
                        Number(submission.Score);

                    subjectMap[
                        subject.Subject_ID
                    ].totalPoints +=
                        Number(assignment.Total_Points);

                }

            });


            // --------------------------------
            // Calculate subject grades
            // --------------------------------

            const subjectResults =
                Object.values(subjectMap).map(subject => {

                    let grade = 0;

                    if (subject.totalPoints > 0) {

                        grade =
                            (
                                subject.totalScore /
                                subject.totalPoints
                            ) * 100;

                    }

                    return {

                        ...subject,

                        grade:
                            Math.round(grade * 10) / 10

                    };

                });


            // --------------------------------
            // Calculate overall grade
            // --------------------------------

            let totalScore = 0;
            let totalPoints = 0;

            subjectResults.forEach(subject => {

                totalScore += subject.totalScore;
                totalPoints += subject.totalPoints;

            });


            const calculatedOverall =
                totalPoints > 0
                    ? (totalScore / totalPoints) * 100
                    : 0;


            setOverallGrade(
                Math.round(
                    calculatedOverall * 10
                ) / 10
            );


            setSubjects(subjectResults);


        } catch (error) {

            console.log(error);

        } finally {

            setLoading(false);

        }

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

            {/* -------------------------------- */}
            {/* PAGE HEADER */}
            {/* -------------------------------- */}

            <div className="progress-header">

                <h1>
                    Progress & Grades
                </h1>

                <p>
                    👤 Tutor: {tutorName}
                </p>

            </div>


            <div className="progress-layout">


                {/* ================================= */}
                {/* LEFT SIDE */}
                {/* ================================= */}

                <div className="subject-breakdown">

                    <h3>
                        Subject Breakdown
                    </h3>


                    {subjects.length === 0 ? (

                        <div className="empty-progress">

                            <h3>
                                No graded assignments yet.
                            </h3>

                            <p>
                                Your grades will appear here
                                once your tutor grades your work.
                            </p>

                        </div>

                    ) : (

                        <div className="subject-progress-grid">

                            {subjects.map(subject => (

                                <div
                                    key={subject.Subject_ID}
                                    className="progress-subject-card"

                                    onClick={() =>
                                        navigate(
                                            `/student/progress/subject/${subject.Subject_ID}`
                                        )
                                    }
                                >

                                    <div className="subject-icon">
                                        📚
                                    </div>


                                    <div className="subject-card-content">

                                        <h3>
                                            {subject.Subject_Name}
                                        </h3>

                                        <p className="tutor-name">
                                            👤 {tutorName}
                                        </p>


                                        <div className="grade-row">

                                            <span>
                                                Grade
                                            </span>

                                            <strong>
                                                {subject.grade}%
                                            </strong>

                                        </div>

                                    </div>


                                    <span className="progress-arrow">
                                        ›
                                    </span>

                                </div>

                            ))}

                        </div>

                    )}

                </div>


                {/* ================================= */}
                {/* RIGHT SIDE */}
                {/* ================================= */}

                <div className="progress-overview">

                    <h3>
                        Overview
                    </h3>


                    {/* Overall Grade */}

                    <div className="overall-grade-card">

                        <span>
                            Average Overall Grade
                        </span>

                        <strong>
                            {overallGrade}%
                        </strong>

                        <p>
                            Based on graded assignments
                        </p>

                    </div>


                    {/* Performance Highlights */}

                    <div className="performance-card">

                        <h3>
                            Performance Highlights
                        </h3>


                        {subjects.length > 0 && (() => {

                            const strongest =
                                [...subjects]
                                    .sort(
                                        (a, b) =>
                                            b.grade - a.grade
                                    )[0];


                            const needsAttention =
                                [...subjects]
                                    .sort(
                                        (a, b) =>
                                            a.grade - b.grade
                                    )[0];


                            return (

                                <>

                                    <div className="highlight-item">

                                        <span>
                                            STRONGEST SUBJECT
                                        </span>

                                        <div>

                                            <strong>
                                                {
                                                    strongest
                                                        ?.Subject_Name
                                                }
                                            </strong>

                                            <b>
                                                {
                                                    strongest
                                                        ?.grade
                                                }%
                                            </b>

                                        </div>

                                    </div>


                                    <div className="highlight-item">

                                        <span>
                                            NEEDS ATTENTION
                                        </span>

                                        <div>

                                            <strong>
                                                {
                                                    needsAttention
                                                        ?.Subject_Name
                                                }
                                            </strong>

                                            <b>
                                                {
                                                    needsAttention
                                                        ?.grade
                                                }%
                                            </b>

                                        </div>

                                    </div>

                                </>

                            );

                        })()}

                    </div>

                </div>

            </div>

        </div>

    );

}

export default StudentProgress;