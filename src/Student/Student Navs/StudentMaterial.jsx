import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import './studentMaterial.css'

function StudentMaterial() {

    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();

    useEffect(() => {
        loadSubjects();
    }, []);

    async function loadSubjects() {

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
            // Get student's materials
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

                        Subjects(
                            Subject_ID,
                            Subject_Name
                        )
                    )
                `)
                .eq("Student_ID", student.id);

            if (error) {
                console.log(error);
                return;
            }


            // --------------------------------
            // Group by subject
            // --------------------------------

            const subjectMap = {};

            data.forEach(item => {

                const material = item.Materials;

                if (!material || !material.Subjects) {
                    return;
                }

                const subject = material.Subjects;

                if (!subjectMap[subject.Subject_ID]) {

                    subjectMap[subject.Subject_ID] = {
                        Subject_ID: subject.Subject_ID,
                        Subject_Name: subject.Subject_Name,
                        materialCount: 0
                    };

                }

                subjectMap[subject.Subject_ID]
                    .materialCount++;

            });


            setSubjects(
                Object.values(subjectMap)
            );

        } catch (error) {

            console.log(error);

        } finally {

            setLoading(false);

        }
    }


    if (loading) {
        return <h2>Loading materials...</h2>;
    }


    return (

        <div className="student-material-container">

            <h1>
                My Learning Materials
            </h1>

            <p>
                Choose a subject
            </p>


            {subjects.length === 0 ? (

                <h3>
                    No materials assigned yet.
                </h3>

            ) : (

                <div className="subject-list">

                    {subjects.map(subject => (

                        <div
                            key={subject.Subject_ID}
                            className="student-subject-card"

                            onClick={() =>
                                navigate(
                                    `/student/materials/subject/${subject.Subject_ID}`
                                )
                            }
                        >

                            <div>

                                <h2>
                                    📚 {subject.Subject_Name}
                                </h2>

                                <p>
                                    {subject.materialCount}{" "}
                                    {subject.materialCount === 1
                                        ? "material Available"
                                        : "materials Available"}
                                </p>

                            </div>


                            <span className="subject-arrow">
                                ›
                            </span>

                        </div>

                    ))}

                </div>

            )}

        </div>

    );
}

export default StudentMaterial;