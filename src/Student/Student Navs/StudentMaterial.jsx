import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function StudentMaterial() {

    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);

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
                    *
                    ,
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
        console.log(data);
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

        acc[subject.Subject_ID].fileTypes[type].push(item.Materials);

        return acc;

    }, {});

    setMaterials(Object.values(grouped));
        setLoading(false);
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

                                    {files.map(material => (

                                        <div
                                            key={material.Material_ID}
                                            className="material-card"
                                        >

                                            <h4>{material.Material_Name}</h4>

                                            <a
                                                href={material.Material_URL}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Open Material
                                            </a>

                                        </div>

                                    ))}

                                </div>

                            ))}

                        </div>

                    ))
            }

        </>
    );
}

export default StudentMaterial;