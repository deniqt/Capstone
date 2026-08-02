import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

function UploadMaterial(){
    const { subjectId } = useParams();

const [subject, setSubject] = useState(null);
const [students, setStudents] = useState([]);

const [selectedStudents, setSelectedStudents] = useState([]);

const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [file, setFile] = useState(null);

   useEffect(()=>{

    loadSubject();

    loadStudents();

},[]);
 async function loadSubject(){

    const { data, error } = await supabase
        .from("Subjects")
        .select("*")
        .eq("Subject_ID", subjectId)
        .single();

    if(error){
        console.log(error);
        return;
    }

    setSubject(data);
}

    async function loadStudents(){

    const {
        data:{user}
    } = await supabase.auth.getUser();

    const { data:tutor } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id",user.id)
        .single();

    const { data, error } = await supabase
        .from("users")
        .select(`
            *,
            details:user_details!users_detail_id_fkey(*)
        `)
        .eq("Role","Student")
        .eq("details.Tutor_ID",tutor.id);

    if(error){
        console.log(error);
        return;
    }

    setStudents(data);
}

    async function uploadMaterial(){

        const {data:{user}}= await supabase.auth.getUser();
        const fileName=`${Date.now()}-${file.name}`;
        const { error }=await supabase.storage
        .from("Material_Storage")
        .upload(fileName,file);

        if(error){
        console.log(error);
        return;
        }

        const { data:urlData }=supabase.storage
        .from("Material_Storage")
        .getPublicUrl(fileName);


        const { data: tutor, error: tutorError } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();

        if (tutorError) {
        console.log(tutorError);
        return;
        }

      const { data: material } = await supabase
        .from("Materials")
        .insert({
            Tutor_ID:tutor.id,
            Subject_ID:subjectId,
            Material_Name:title,
            Material_Description:description,
            Material_URL:urlData.publicUrl,
            file_name:file.name
        })
        .select()
        .single();
        console.log(material);


        const assignments = selectedStudents.map(studentId => ({
            Material_ID:material.Material_ID,
            Student_ID:studentId
        }));

        const { error:AssignmentError } = await supabase
        .from("Material_Assignment")
        .insert(assignments);
        if(AssignmentError){
            console.log(error);
            return;
        }

        alert("Material Uploaded!");
    }

    function toggleStudent(studentId){

        if(selectedStudents.includes(studentId)){

            setSelectedStudents(

                selectedStudents.filter(id=>id!==studentId)

            );

        }

        else{

            setSelectedStudents([

                ...selectedStudents,

                studentId

            ]);

        }

    }
    return(
        <>
        <h1>

        Upload Material

        </h1>

        <h3>Assign Students</h3>

            {
                students.map(student=>(

                    <label
                        key={student.id}
                        style={{
                            display:"block",
                            marginBottom:"10px"
                        }}
                    >

                        <input

                            type="checkbox"

                            onChange={()=>toggleStudent(student.id)}

                        />

                        {" "}

                        {student.Name}

                    </label>

                ))
            }

        <input

        placeholder="Title"

        value={title}

        onChange={(e)=>setTitle(e.target.value)}

        />

        <textarea

        placeholder="Description"

        value={description}

        onChange={(e)=>setDescription(e.target.value)}

        />

        <input

        type="file"

        onChange={(e)=>setFile(e.target.files[0])}

        />

        <button

        onClick={uploadMaterial}

        >

        Upload

        </button>
        </>
    );
}

export default UploadMaterial;