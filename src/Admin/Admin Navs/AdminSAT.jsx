import { useEffect, useState } from 'react';
import './adminSAT.css'
import { supabase } from '../../lib/supabase';
import AdminEditProfile from './AdminEditProfile';
import { Navigate, NavLink, useNavigate } from 'react-router-dom';


function AdminSAT(){

    const [students, setStudents] = useState([]);
    const [tutors, setTutors] = useState([]);
    const [users, setUsers] = useState([]);
    const navigate = useNavigate();

    const[tableActive, setTableAcctive] = useState("All");

    useEffect(() => {
        
        const interval = setInterval(() => {
        getUsers();
        getStudent();
        getTutors();
        }, 500);

    return () => clearInterval(interval);
    }, []);

    async function getUsers() {
        const { data, error } = await supabase
            .from("users")
            .select("*");

        if (!error) {
            setUsers(data);
        }
    }

     async function getStudent() {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("Role","Student");


        if (!error) {
            setStudents(data);
        }
    }

     async function getTutors() {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("Role","Tutor");

        if (!error) {
            setTutors(data);
        }
    }
    return(<>
        <h1 id="SATTitle">Student & Teacher</h1>

        <div className="TableBox">
            <div className="TableHead">
                <button className="TableOption" onClick={()=>{{setTableAcctive("All")}}}>All Users</button>
                <button className="TableOption" onClick={()=>{{setTableAcctive("Student")}}}>Student</button>
                <button className="TableOption" onClick={()=>{{setTableAcctive("Tutor")}}}>Tutors</button>
            </div>

            <div className='mainTable'>
                <table className='user-table'>

                    <thead>
                        <tr>
                            <th>USER</th>
                            <th>Role</th>
                            <th>Joined Date</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                         {tableActive === "All" &&
                            users.map((user) => (
                            <tr key={user.id}>
                                <td>{user.Name}</td>
                                <td>{user.Role}</td>
                                <td>{user.Joined}</td>
                                <td>{user.Status}</td>
                                <td><button onClick={ 
                                 ()=>navigate(`/admin/EditProfile/${user.id}`)
                                }>Edit</button></td>
                            </tr>
                            ))}

                        {tableActive === "Student" &&
                            students.map((student) => (
                            <tr key={student.id}>
                                <td>{student.Name}</td>
                                <td>{student.Role}</td>
                                <td>{student.Joined}</td>
                                <td>{student.Status}</td>
                                <td><button >Edit</button></td>
                            </tr>
                            ))}

                        {tableActive === "Tutor" &&
                            tutors.map((tutor) => (
                            <tr key={tutor.id}>
                                <td>{tutor.Name}</td>
                                <td>{tutor.Role}</td>
                                <td>{tutor.Joined}</td>
                                <td>{tutor.Status}</td>
                                <td><button >Edit</button></td>
                            </tr>
                            ))}
                       
                    </tbody>
                </table>
            </div>

        </div>
    </>);
}

export default AdminSAT