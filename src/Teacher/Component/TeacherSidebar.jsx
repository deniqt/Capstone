
import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import MainHeader from "../../MainComponent/MainHeader";
import { LayoutDashboard,
        File,
        GraduationCap,
        CalendarCheck,
        MessageSquare,
        Settings} from "lucide-react";
import "./teacherSidebar.css"
function TeacherSidebar(){
    
        const [userInfo, setUserInfo] = useState(null);
        const [profileUrl, setProfileUrl] = useState(null);

     const navigate = useNavigate();
    // ==========================================
    // LOAD LOGGED-IN USER
    // ==========================================

    useEffect(() => {

        async function loadUser() {

            try {

                // Get currently logged-in Auth user
                const {
                    data: { user },
                    error: authError
                } = await supabase.auth.getUser();


                if (authError || !user) {
                    console.error(
                        "Unable to get authenticated user:",
                        authError
                    );
                    return;
                }


                // Get user information
                const {
                    data: userData,
                    error: userError
                } = await supabase
                    .from("users")
                    .select(`
                        id,
                        Name,
                        Role,
                        detail_id
                    `)
                    .eq("auth_id", user.id)
                    .single();


                if (userError) {
                    console.error(
                        "Unable to retrieve user information:",
                        userError
                    );
                    return;
                }


                setUserInfo(userData);


                // ==========================================
                // GET PROFILE IMAGE
                // ==========================================

                if (userData.detail_id) {

                    const {
                        data: detailsData,
                        error: detailsError
                    } = await supabase
                        .from("user_details")
                        .select("profile_url")
                        .eq(
                            "detail_id",
                            userData.detail_id
                        )
                        .single();


                    if (detailsError) {

                        console.error(
                            "Unable to retrieve profile image:",
                            detailsError
                        );

                    } else {

                        setProfileUrl(
                            detailsData?.profile_url || null
                        );

                    }

                }

            } catch (error) {

                console.error(
                    "Error loading sidebar user:",
                    error
                );

            }

        }


        loadUser();

    }, []);

return(
    <div className="sidebar">
        <h2>Yoseff Teacher Side</h2>

       
        

        <nav className="sidebar-nav">

               <NavLink to="/teacher" end>  <LayoutDashboard className="sideBar-logo"/>Dashboard</NavLink>
               <NavLink to="/teacher/material"> <File className="sideBar-logo"/>Material</NavLink>
               <NavLink to="/teacher/schedule"><CalendarCheck className="sideBar-logo"/> Scheduling</NavLink>
               <NavLink to="/teacher/students"> <GraduationCap className="sideBar-logo"/>Students</NavLink>
                 <NavLink to="/teacher/messages">
                 <MessageSquare className="sideBar-logo"/>
                    Messages
                </NavLink>
               <NavLink to="/teacher/settings">
               <Settings className="sideBar-logo"/>Settings</NavLink> 

        </nav>

        {/* ======================================
                USER PROFILE
            ====================================== */}

            {userInfo && (

                <div
                    className="sidebarUser"
                    onClick={() =>
                        navigate("/teacher/settings")
                    }
                >

                    <div className="sidebarUserImage">

                        {profileUrl ? (

                            <img
                                src={profileUrl}
                                alt={userInfo.Name}
                            />

                        ) : (

                            <div className="sidebarUserPlaceholder">
                                {userInfo.Name
                                    ?.charAt(0)
                                    ?.toUpperCase()
                                }
                            </div>

                        )}

                    </div>


                    <div className="sidebarUserInfo">

                        <span className="sidebarUserName">
                            {userInfo.Name}
                        </span>

                        <span className="sidebarUserRole">
                            {userInfo.Role}
                        </span>

                    </div>

                </div>

            )}

    </div>
);

}

export default TeacherSidebar