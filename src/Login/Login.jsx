
import { useEffect, useState } from 'react';
import './login.css';
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff } from "lucide-react";
import BackgroundImage from "../assets/LoginLogo.png";
import BackgroundImage2 from "../assets/SplashScreen.png";

function Login() {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const navigate = useNavigate();


    // ==========================================
    // LOAD REMEMBERED EMAIL
    // ==========================================

    useEffect(() => {

        const savedEmail = localStorage.getItem("rememberedEmail");

        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }

    }, []);


    // ==========================================
    // LOGIN
    // ==========================================

    async function handleLogin() {

        if (!email || !password) {
            alert("Please enter your email and password.");
            return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });


        // Login error
        if (error) {

            if (error.message && error.message.toLowerCase().includes("fetch")) {
                alert(
                    "Network error: Unable to connect to Supabase database.\n\n" +
                    "Possible causes:\n" +
                    "1. The .env file is missing in the project folder.\n" +
                    "2. The laptop is not connected to the internet."
                );
            } else {
                alert(error.message);
            }

            setPassword("");

            return;
        }


        const authUser = data.user;


        // ==========================================
        // GET USER INFORMATION
        // ==========================================

        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("Role, Status")
            .eq("auth_id", authUser.id)
            .single();


        if (userError) {

            alert("Unable to retrieve user information.");

            await supabase.auth.signOut();

            return;
        }


        // ==========================================
        // CHECK ACCOUNT STATUS
        // ==========================================

        if (userData.Status !== "Active") {

            alert(
                "Your account has been deactivated. Please contact the administrator."
            );

            await supabase.auth.signOut();

            setEmail("");
            setPassword("");

            return;
        }


        // ==========================================
        // REMEMBER EMAIL
        // ==========================================

        if (rememberMe) {

            localStorage.setItem(
                "rememberedEmail",
                email
            );

        } else {

            localStorage.removeItem("rememberedEmail");

        }


        // ==========================================
        // REDIRECT BASED ON ROLE
        // ==========================================

        switch (userData.Role) {

            case "Tutor":
                navigate("/teacher");
                break;

            case "Student":
                navigate("/student");
                break;

            case "Admin":
                navigate("/admin");
                break;

            default:

                alert("Login not valid.");

                await supabase.auth.signOut();
        }
    }


    return (
        <div className="mainPanel">

            {/* ======================================
                IMAGE
            ====================================== */}

            <div className="imageBackground">

                <img
                    src={BackgroundImage}
                    id="ImageLogin"
                    alt="Login"
                />

                  <img
                    src={BackgroundImage2}
                    id="ImageLogin2"
                    alt="Login"
                />

            </div>


            {/* ======================================
                LOGIN SIDE
            ====================================== */}

            <div className="textfieldPanel">

                <h1 id="loginTitle">
                    Welcome to<br />
                    YOSEF's Tutorial Center
                </h1>


                <div className="loginPanel">

                    <h1>
                        Login
                    </h1>


                    {/* EMAIL */}

                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => {

                            if (e.key === "Enter") {
                                handleLogin();
                            }

                        }}
                    />


                    {/* PASSWORD */}

                    <div className="passwordInputWrapper">

                        <input
                            type={
                                showPassword
                                    ? "text"
                                    : "password"
                            }

                            placeholder="Password"

                            value={password}

                            onChange={(e) =>
                                setPassword(e.target.value)
                            }

                            onKeyDown={(e) => {

                                if (e.key === "Enter") {
                                    handleLogin();
                                }

                            }}
                        />


                        <button
                            type="button"
                            className="passwordToggle"

                            onClick={() =>
                                setShowPassword(!showPassword)
                            }

                            aria-label={
                                showPassword
                                    ? "Hide password"
                                    : "Show password"
                            }
                        >

                            {showPassword ? (
                                <EyeOff size={20} />
                            ) : (
                                <Eye size={20} />
                            )}

                        </button>

                    </div>


                    {/* REMEMBER ME */}

                    <div className="rememberMe">

                        <label>

                            <input
                                type="checkbox"

                                checked={rememberMe}

                                onChange={(e) =>
                                    setRememberMe(e.target.checked)
                                }
                            />

                            <span>
                                Remember me
                            </span>

                        </label>

                         <button
                          type="button"
                          id='Forgot-Button'
                          onClick={() => navigate("/forgot-password")}
                      >
                          Forgot Password?
                      </button>

                    </div>

                     
               


                    {/* LOGIN BUTTON */}

                    <button
                        type="button"
                        className="loginButton"
                        onClick={handleLogin}
                    >
                        Login
                    </button>


                    {/* CREATE ACCOUNT */}

                    <div className="createAccount">

                        Don't Have Account? 

                        <button
                            type="button"
                            onClick={() =>
                                navigate('/landing')
                            }
                        >
                             Click here
                        </button>

                    </div>

                </div>

            </div>

        </div>
    );
}

export default Login;
