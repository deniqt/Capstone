import { supabase } from '../../lib/supabase';
import './adminSidebar.css'
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard,
        File,
        User,
        CreditCard,
        TrendingUp,
        CalendarCheck,
        MessageSquare,
        Settings} from "lucide-react";
import { useEffect, useState } from 'react';
function AdminSidebar(){

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

  
return(
    <div className="sidebar" >
        <h2>Yoseff Admin Side</h2>

        <nav className="sidebar-nav">

               <NavLink to="/admin" end> <LayoutDashboard className="sideBar-logo"/> Dashboard</NavLink>
               <NavLink to="/admin/schedule"><CalendarCheck className="sideBar-logo"/>Schedule</NavLink>
               <NavLink to="/admin/student-and-tutor"><User className="sideBar-logo"/>Student & Tutor</NavLink>
               <NavLink to="/admin/payment"><CreditCard className="sideBar-logo"/>Payment</NavLink>
               <NavLink to="/admin/report"><TrendingUp className="sideBar-logo"/>Report</NavLink>
               <NavLink to="/admin/settings"><Settings className="sideBar-logo"/>settings</NavLink>

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

export default AdminSidebar