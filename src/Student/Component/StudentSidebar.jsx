import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { LayoutDashboard,
        File,
        TrendingUp,
        CalendarCheck,
        MessageSquare,CalendarSync,
        Settings} from "lucide-react";
import "./studentSidebar.css";

function StudentSidebar() {

    const navigate = useNavigate();

    const [userInfo, setUserInfo] = useState(null);
    const [profileUrl, setProfileUrl] = useState(null);


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


    


    return (

        <div className="sidebar">

            <h2>
                Yoseff Student Side
            </h2>


            <nav className="sidebar-nav">


                <NavLink
                    to="/student"
                    end
                >
                    <LayoutDashboard className="sideBar-logo"/>
                    Dashboard
                </NavLink>


                <NavLink
                    to="/student/materials"
                >
                    <File className="sideBar-logo"/>
                    Material
                </NavLink>


                <NavLink
                    to="/student/progress"
                >
                    <TrendingUp className="sideBar-logo"/>
                    Progress
                </NavLink>


                <NavLink
                    to="/student/schedule"
                >
                    <CalendarCheck className="sideBar-logo"/>
                    Schedule
                </NavLink>


                <NavLink
                    to="/student/messages"
                >
                    <MessageSquare className="sideBar-logo"/>
                    Messages
                </NavLink>

                  <NavLink
                    to="/student/subscription"
                >
                    <CalendarSync className="sideBar-logo"/>
                    Manage Subscription
                </NavLink>


                <NavLink
                    to="/student/settings"
                >
                    <Settings className="sideBar-logo"/>
                    Settings
                </NavLink>



            </nav>


            {/* ======================================
                USER PROFILE
            ====================================== */}

            {userInfo && (

                <div
                    className="sidebarUser"
                    onClick={() =>
                        navigate("/student/settings")
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

export default StudentSidebar;

