
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import MainHeader from "../../MainComponent/MainHeader";
import "./teacherSidebar.css"
function TeacherSidebar(){

     const navigate = useNavigate();

    async function handleLogout() {
        const { error } = await supabase.auth.signOut();

        if (error) {
            alert(error.message);
            return;
        }
            navigate("/");

    }
return(
    <div className="sidebar">
        <h2>Yoseff Teacher Side</h2>

       
        

        <nav className="sidebar-nav">

               <NavLink to="/teacher" end>Dashboard</NavLink>
               <NavLink to="/teacher/material">Material</NavLink>
               <NavLink to="/teacher/schedule">Scheduling</NavLink>
               <NavLink to="/teacher/students">Students</NavLink>
                 <NavLink to="/teacher/messages">
                    Messages
                </NavLink>
               <NavLink to="/teacher/settings">Settings</NavLink> 
              <button onClick={handleLogout}>
                Log Out
               </button>

        </nav>

    </div>
);

}

export default TeacherSidebar