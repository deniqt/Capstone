import { useEffect,useState } from "react";
import { useParams,useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function TeacherSubject(){

    const {subjectId}=useParams();

    const navigate=useNavigate();

    const [subject,setSubject]=useState(null);

    const [materials,setMaterials]=useState([]);

    useEffect(()=>{

        loadPage();

    },[]);

    async function loadPage(){

        const {data:sub}=await supabase

        .from("Subjects")

        .select("*")

        .eq("Subject_ID",subjectId)

        .single();

        setSubject(sub);

        const {data}=await supabase

        .from("Materials")

        .select("*")

        .eq("Subject_ID",subjectId)

        .order("created_at",{ascending:false});

        setMaterials(data);

    }

    return(

        <>

        {

            subject&&

            <>

            <h1>{subject.Subject_Name}</h1>

            </>

        }

        <button

        onClick={()=>navigate(`/teacher/upload/${subjectId}`)}

        >

        Upload Material

        </button>

        <hr/>

        {

            materials.map(material=>(

                <div

                key={material.Material_ID}

                >

                    <h3>

                    {material.Material_Name}

                    </h3>

                    <p>

                    {material.Material_Description}

                    </p>

                </div>

            ))

        }

        </>

    );

}

export default TeacherSubject;