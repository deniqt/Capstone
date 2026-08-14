
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import MainHeader from "../../MainComponent/MainHeader";
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
    <div
    style={{
        width: "250px",
        background: "#222",
        color: "white",
        padding: "20px",
      }}
    >
        <h2>Yoseff Teacher Side</h2>

       
        

        <nav style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",  
        }}>

               <NavLink to="/teacher">Dashboard</NavLink>
               <NavLink to="/teacher/material">Material</NavLink>
               <NavLink to="/teacher/schedule">Scheduling</NavLink>
               <NavLink to="/teacher/student">Students</NavLink>
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