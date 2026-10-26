import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./teacherMaterial.css"

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


    function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}
const getProfileImage = (student) =>
  student.profile_url || student.details?.profile_url || null;

// inside TeacherMaterial():
const openStudent = (id) => navigate(`/teacher/materials/${id}`);

return (
  <>
    <h1>TEACHER MATERIALS</h1>
    <p className="table-hint">Select a student to view and manage their materials.</p>

    <div className="mainTable">
      <table className="user-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Grade</th>
            <th>Email</th>
            <th aria-hidden="true"></th>
          </tr>
        </thead>

        <tbody>
          {students.length === 0 ? (
            <tr className="empty-row">
              <td colSpan={4}>No students assigned yet.</td>
            </tr>
          ) : (
            students.map((student) => (
              <tr
                key={student.id}
                className="clickable-row"
                tabIndex={0}
                role="link"
                aria-label={`View materials for ${student.Name}`}
                onClick={() => openStudent(student.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openStudent(student.id);
                  }
                }}
              >
                <td>
                <div className="student-cell">
                    {getProfileImage(student) ? (
                    <img
                        src={getProfileImage(student)}
                        alt={student.Name}
                        className="student-avatar student-avatar-img"
                    />
                    ) : (
                    <span className="student-avatar">{getInitials(student.Name)}</span>
                    )}
                    <span className="student-name">{student.Name}</span>
                </div>
                </td>
                <td>
                  <span className="grade-pill">{student.details.Grade_Level}</span>
                </td>
                <td className="email-cell">{student.Email}</td>
                <td className="action-cell">
                  <span className="row-action">
                    View materials <span className="row-arrow">→</span>
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </>
);
}

export default TeacherMaterial