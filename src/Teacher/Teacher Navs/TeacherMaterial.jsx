import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";

function TeacherMaterial(){

    const [students, setStudents] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
      async function loadTutor() {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("auth_id", user.id)
            .single();

        if (error) {
            console.log(error);
            return;
        }

        console.log("Tutor", data);
        getStudents(data.id)
    }

    loadTutor();

    },[])


    async function getStudents(TutorID){
        const{data, error} = await supabase
        .from("users")
        .select(`*,
                details:user_details!users_detail_id_fkey!inner(*)
            `)
        .eq("Role", "Student")
        .eq("details.Tutor_ID", TutorID)

        if(error){
            console.log(error)
        }

        console.log("Student List:", data)
        setStudents(data);
    }


    return(<>
     <h1> TEACHER MATERIALS</h1>

        <div className='mainTable'>
            <table className='user-table'>
                 <thead>
                    <tr>
                        <th>Name</th>
                        <th>Grade</th>
                        <th>Email</th>
                    </tr>
                </thead>

                <tbody>
                    {
                        students.map((student)=>(
                            <tr key={student.id} onClick={() => navigate(`/teacher/materials/${student.id}`)}>
                                <td>
                                    {student.Name}
                                </td>
                                <td>
                                    {student.details.Grade_Level}
                                </td>
                                 <td>
                                    {student.Email}
                                </td>
                            </tr>
                            )
                            
                        )
                    }
                </tbody>
            </table>
              
        </div>
    </>);
}

export default TeacherMaterial