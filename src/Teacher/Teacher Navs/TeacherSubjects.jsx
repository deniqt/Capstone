import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate, useParams } from "react-router-dom";
import "./teacherSubjects.css"

function TeacherSubjects(){
    const {studentID}=useParams();
    const [subjects,setSubjects]=useState([]);
    const [student, setStudent]=useState([]);
    const [title, setTitle] = useState("");
    const [allSubjects, setAllSubjects] = useState([]);
    const[selectedSubject, setSelectedSubject] = useState("");
const [description, setDescription] = useState("");
const [file, setFile] = useState(null);
    const navigate=useNavigate();
    const [showModal, setShowModal] = useState(false);
    useEffect(()=>{
        console.log("useEffect ran");
        LoadData();

    },[]);

    async function LoadData(){

        const {data,error}=await supabase

        .from("Material_Assignment")
        .select(`
            ID,
            Materials(
                Material_ID,
                Material_Name,
                Material_URL,
                file_name,
                users(
                    Name
                ),
                Subjects(
                    Subject_ID,
                    Subject_Name
                )
            )

            ` )
            .eq("Student_ID", studentID)
            ;
        if(error){

            console.log(error);

            return;

        }
        console.log(data);

    const grouped = data.reduce((acc, item) => {
    const subject = item.Materials.Subjects;
    const extension = item.Materials.file_name
        .split(".")
        .pop()
        .toLowerCase();
    let type = "Others";
    if (["pdf"].includes(extension))
        type = "PDF";
    else if (["mp4","mov"].includes(extension))
        type = "Video";
    else if (["png","jpg","jpeg"].includes(extension))
        type = "Image";
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

        setSubjects(Object.values(grouped));

        const{data:UserData, error:UserError} = await supabase
        .from("users")
        .select("*")
        .eq("id", studentID)
        .single();

        if(UserError){
            return;
        }

        setStudent(UserData);

        const { data: subjectData, error: subjectError } = await supabase
            .from("Subjects")
            .select("*")
            .order("Subject_Name");

        if (subjectError) {
            console.log(subjectError);
            return;
        }

        setAllSubjects(subjectData);

        if (subjectData.length > 0) {
            setSelectedSubject(subjectData[0].Subject_ID);
        }

    }

    async function uploadMaterial(){

        if (!file) {
            alert("Please select a file.");
            return;
        }

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
            Subject_ID:selectedSubject,
            Material_Name:title,
            Material_Description:description,
            Material_URL:urlData.publicUrl,
            file_name:file.name
        })
        .select()
        .single();
        console.log(material);

        const { error:AssignmentError } = await supabase
        .from("Material_Assignment")
        .insert({
            Material_ID:material.Material_ID,
            Student_ID:studentID
            }
            );
        if(AssignmentError){
            console.log(AssignmentError);
            return;
        }

        alert("Material Uploaded!");
        await LoadData();

        setTitle("");
        setDescription("");
        setFile(null);
        setShowModal(false);
    }

    

    return(

        

        <div className="subject-container">
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Material Details</h2>

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
                            <select
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value)}
                            >
                                {allSubjects.map(subject => (
                                    <option
                                        key={subject.Subject_ID}
                                        value={subject.Subject_ID}
                                    >
                                        {subject.Subject_Name}
                                    </option>
                                ))}
                            </select>

                            <button

                            onClick={uploadMaterial}

                            >

                            Upload

                            </button>

                        <button onClick={() => setShowModal(false)}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            <h1>Files ni {student.Name}</h1>
            <button onClick={() => setShowModal(true)}>Upload File</button>

            {

              subjects.map(subject => (

                    <div
                        key={subject.Subject_ID}
                        className="subject-card"
                    >

                        <h2>📚 {subject.Subject_Name}</h2>

                        {Object.entries(subject.fileTypes).map(([type, materials]) => (

                            <div
                                key={type}
                                className="file-type-group"
                            >

                                <h3>{type}</h3>

                                {materials.map(material => (
                                <>
                                    <a
                                        key={material.Material_ID}
                                        className="file-type-group"
                                        href={material.Material_URL}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        📄 {material.Material_Name}
                                    </a> 
                                    <br/>
                                </>
                                   

                                ))}

                            </div>

                        ))}

                    </div>

                ))
            }

        </div>

    );

}

export default TeacherSubjects;