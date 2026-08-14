import MainHeader from '../MainComponent/MainHeader';
import TeacherSidebar from './Component/TeacherSidebar'
import './teacherDashboard.css'
import { Outlet } from "react-router-dom";

function TeacherDashboard(){
return(
    <div style={{ display: "flex", height: "100vh" }}>
        
        <TeacherSidebar/>
        
         <div style={{ flex: 1, padding: "20px" }}>
             <MainHeader/>
             <Outlet />
        </div>
    </div>

    
);
}
export default TeacherDashboard