import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate, useParams } from "react-router-dom";
import {FileText,
        Presentation,
        File,
        Film,
        Image,
        ClipboardList
} from "lucide-react";
import './studentMaterial.css'

function StudentSubject() {

    const { subjectID } = useParams();

    const navigate = useNavigate();

    const [materials, setMaterials] = useState([]);
    const [subjectName, setSubjectName] = useState("");
    const [loading, setLoading] = useState(true);


    useEffect(() => {

        loadMaterials();

    }, [subjectID]);


    async function loadMaterials() {

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
            // Get materials
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
                        Material_URL,
                        Material_Description,
                        file_name,

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
            // Only this subject
            // --------------------------------

            const filtered = data.filter(item => {

                return (
                    String(item.Materials?.Subjects?.Subject_ID) ===
                    String(subjectID)
                );

            });


            if (
                filtered.length > 0 &&
                filtered[0].Materials?.Subjects
            ) {

                setSubjectName(
                    filtered[0]
                        .Materials
                        .Subjects
                        .Subject_Name
                );

            }


            // --------------------------------
            // Group materials
            // --------------------------------

            const grouped = {};

            filtered.forEach(item => {

                const material = item.Materials;

                if (!material) {
                    return;
                }

                // --------------------------------
                // Check if this is an assignment
                // --------------------------------

                const assignment = material.Assignments?.[0];

                let type;

                if (assignment) {

                    // All assignments go into
                    // their own folder

                    type = "Assignments";

                } else {

                    // --------------------------------
                    // Normal material → file type
                    // --------------------------------

                    const extension =
                        material.file_name
                            ?.split(".")
                            .pop()
                            .toLowerCase() || "";

                    type = "Others";

                    if (["pdf"].includes(extension)) {

                        type = "PDF";

                    } else if (
                        ["mp4", "mov", "avi", "mkv"].includes(extension)
                    ) {

                        type = "Video";

                    } else if (
                        ["png", "jpg", "jpeg"].includes(extension)
                    ) {

                        type = "Image";

                    } else if (
                        ["doc", "docx"].includes(extension)
                    ) {

                        type = "Word";

                    } else if (
                        ["ppt", "pptx"].includes(extension)
                    ) {

                        type = "PowerPoint";

                    }

                }


                // --------------------------------
                // Create group
                // --------------------------------

                if (!grouped[type]) {
                    grouped[type] = [];
                }

                grouped[type].push(material);

            });


            setMaterials(
                Object.entries(grouped)
            );

        } catch (error) {

            console.log(error);

        } finally {

            setLoading(false);

        }
    }


    if (loading) {

        return (
            <h2>
                Loading materials...
            </h2>
        );

    }


    return (

        <div className="student-subject-container">

            {/* Breadcrumb */}

            <div className="breadcrumb">

                <button
                    onClick={() =>
                        navigate("/student/materials")
                    }
                >
                    Materials
                </button>

                <span>
                    ›
                </span>

                <span>
                    {subjectName}
                </span>

            </div>


            <h1>
                📚 {subjectName}
            </h1>


            <p>
                {materials.reduce(
                    (total, [, files]) =>
                        total + files.length,
                    0
                )}{" "}
                materials
            </p>


            {materials.map(
                ([type, files]) => (

                    <div
                        key={type}
                        className="material-type-section"
                    >

                        <h2>
                            {type === "Assignments" ? (<div className="Type-Title"><ClipboardList color="Green" className="Type-Logo"/> Assignment</div>)
                                    : type ==="PDF"? (<div className="Type-Title"><FileText color="red" className="Type-Logo"/> PDF</div>)
                                        : type ==="PowerPoint"? (<div className="Type-Title"><Presentation color="Yellow" className="Type-Logo"/> Power Point</div>)
                                            : type ==="Video"? (<div className="Type-Title"><Film color="Purple" className="Type-Logo"/> Video Recording</div>)
                                                : type ==="Image"? (<div className="Type-Title"><Image color="Black" className="Type-Logo"/> Image</div>)
                                                    : type ==="Word"? (<div className="Type-Title"><File color="Blue" className="Type-Logo"/> Document</div>)
                                                     :`📁 ${type}`}
                        </h2>

                        {files.map(material => {

                            const assignment =
                                material.Assignments?.[0];


                            return (

                                <div
                                    key={material.Material_ID}
                                    className="material-list-card"

                                    onClick={() => {

                                       if (assignment) {

                                            navigate(
                                                `/student/materials/assignment/${assignment.Assignment_ID}`
                                            );

                                        } else {

                                            navigate(
                                                `/student/materials/material/${material.Material_ID}`
                                            );

                                        }
                                    }}
                                >

                                    <div>

                                        <h3>

                                            {type === "Assignments" ? (<div className="Type-Title"><ClipboardList color="Green" className="Type-Logo"/> {material.Material_Name}</div>)
                                                : type ==="PDF"? (<div className="Type-Title"><FileText color="red" className="Type-Logo"/> {material.Material_Name}</div>)
                                                    : type ==="PowerPoint"? (<div className="Type-Title"><Presentation color="Yellow" className="Type-Logo"/> {material.Material_Name}</div>)
                                                        : type ==="Video"? (<div className="Type-Title"><Film color="Purple" className="Type-Logo"/> {material.Material_Name}</div>)
                                                            : type ==="Image"? (<div className="Type-Title"><Image color="Black" className="Type-Logo"/> {material.Material_Name}</div>)
                                                                : type ==="Word"? (<div className="Type-Title"><File color="Blue" className="Type-Logo"/> {material.Material_Name}</div>)
                                                                :`📁 ${material.Material_Name}`}

                                        </h3>


                                        {assignment ? (

                                            <p>

                                                {assignment.Assignment_Type}

                                                {" • "}

                                                Due:{" "}

                                                {new Date(
                                                    assignment.Due_Date
                                                ).toLocaleString()}

                                                {" • "}

                                                {assignment.Total_Points}
                                                {" points"}

                                            </p>

                                        ) : (

                                            <p>
                                                {material.Material_Description}
                                            </p>

                                        )}

                                    </div>


                                    <span>
                                        ›
                                    </span>

                                </div>

                            );

                        })}

                    </div>

                )
            )}

        </div>

    );

}

export default StudentSubject;