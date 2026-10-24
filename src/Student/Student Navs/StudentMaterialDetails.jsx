import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate, useParams } from "react-router-dom";
import "./studentMaterial.css";
import {File} from "lucide-react";

function StudentMaterialDetails() {

    const { materialID } = useParams();

    const navigate = useNavigate();

    const [material, setMaterial] = useState(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {

        loadMaterial();

    }, [materialID]);


    async function loadMaterial() {

        setLoading(true);

        try {

            // --------------------------------
            // Get material
            // --------------------------------

            const {
                data,
                error
            } = await supabase
                .from("Materials")
                .select(`
                    Material_ID,
                    Material_Name,
                    Material_URL,
                    Material_Description,
                    file_name,

                    Subjects(
                        Subject_ID,
                        Subject_Name
                    )
                `)
                .eq("Material_ID", materialID)
                .single();


            if (error) {

                console.log(error);

                return;
            }


            setMaterial(data);


        } catch (error) {

            console.log(error);

        } finally {

            setLoading(false);

        }

    }


    if (loading) {

        return (
            <h2>
                Loading material...
            </h2>
        );

    }


    if (!material) {

        return (
            <div>

                <h2>
                    Material not found.
                </h2>

                <button
                    onClick={() =>
                        navigate("/student/materials")
                    }
                >
                    Back to Materials
                </button>

            </div>
        );

    }


    const extension =
        material.file_name
            ?.split(".")
            .pop()
            .toLowerCase() || "";


    let fileType = "Other";


    if (extension === "pdf") {

        fileType = "PDF";

    } else if (
        ["mp4", "mov", "avi", "mkv"]
            .includes(extension)
    ) {

        fileType = "Video";

    } else if (
        ["png", "jpg", "jpeg"]
            .includes(extension)
    ) {

        fileType = "Image";

    } else if (
        ["doc", "docx"]
            .includes(extension)
    ) {

        fileType = "Word";

    } else if (
        ["ppt", "pptx"]
            .includes(extension)
    ) {

        fileType = "PowerPoint";

    }


    return (

        <div className="student-material-details">

            {/* -------------------------------- */}
            {/* Breadcrumb */}
            {/* -------------------------------- */}

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
                    {material.Material_Name}
                </span>

            </div>


            {/* -------------------------------- */}
            {/* Header */}
            {/* -------------------------------- */}

            <div className="material-details-header">

                <div>

                    <p className="material-type">
                        {fileType}
                    </p>

                    <h1>
                        <File color="Red"/> {material.Material_Name}
                    </h1>
                </div>

            </div>


            {/* -------------------------------- */}
            {/* Main Content */}
            {/* -------------------------------- */}

            <div className="material-details-grid">


                {/* -------------------------------- */}
                {/* Information */}
                {/* -------------------------------- */}

                <div className="material-details-card">

                    <h2>
                        Details
                    </h2>

                    <div className="detail-row">

                        <span>
                            File Name
                        </span>

                        <strong>
                            {material.file_name}
                        </strong>

                    </div>


                    <div className="detail-row">

                        <span>
                            Type
                        </span>

                        <strong>
                            {fileType}
                        </strong>

                    </div>


                    <div className="detail-row">



                    </div>

                </div>


                {/* -------------------------------- */}
                {/* Description */}
                {/* -------------------------------- */}

                <div className="material-details-card">

                    <h2>
                        Description
                    </h2>

                    <p>

                        {material.Material_Description
                            || "No description provided."}

                    </p>

                </div>


                {/* -------------------------------- */}
                {/* Open Material */}
                {/* -------------------------------- */}

                <div className="material-details-card">

                    <h2>
                        Learning Material
                    </h2>

                    <p>
                        Open the material to start learning.
                    </p>

                    <button
                        onClick={() =>
                            window.open(
                                material.Material_URL,
                                "_blank"
                            )
                        }
                    >
                        📄 Open Material
                    </button>

                </div>


            </div>

        </div>

    );

}


export default StudentMaterialDetails;