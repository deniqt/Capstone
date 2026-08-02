
import StudentSidebar from './Component/StudentSidebar';
import './studentDashboard.css'
import { Outlet } from "react-router-dom";

function StudentDashboard(){
return(
    <div style={{ display: "flex", height: "100vh" }}>
        
        <StudentSidebar/>
         <div style={{ flex: 1, padding: "20px" }}>
             <Outlet />
        </div>
    </div>

    
);
}
export default StudentDashboard