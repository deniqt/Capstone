import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BackgroundImage from "../assets/LoginImage.png";
import BackgroundImage2 from "../assets/SplashScreen.png";
import LockImage from "../assets/Lock.svg";
import "./login.css";

function ForgotPassword() {

    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const navigate = useNavigate();


    async function handleForgotPassword(e) {

        e.preventDefault();

        if (!email) {
            setMessage("Please enter your email address.");
            return;
        }

        setLoading(true);
        setMessage("");

        const { error } = await supabase.auth.resetPasswordForEmail(
            email,
            {
                redirectTo:
                    `${window.location.origin}/reset-password`,
            }
        );

        setLoading(false);

        if (error) {
            setMessage(error.message);
            return;
        }

        setMessage(
            "If an account exists with this email, a password reset link has been sent."
        );
    }


    return (
        <div className="authPage">

              <div className="authImage2">

                 <img
                    src={BackgroundImage2}
                    alt="YOSEF's Tutorial Center"
                    id="BG2"
                />

            </div>

            {/* CONTENT */}

            <div className="authContent">

                

                <h2 className="authTitle">
                    YOSEF's Tutorial Center
                </h2>


                <div className="authCard">

                    <img
                    src={LockImage}
                    className="LockLogo"
                    alt="Password reset"
                />

                    <h1>
                        Forgot Password?
                    </h1>

                    <p className="authDescription">
                        Enter your email address and we'll send
                        you a link to reset your password.
                    </p>


                    <form onSubmit={handleForgotPassword}>

                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) =>
                                setEmail(e.target.value)
                            }
                        />


                        <button
                            type="submit"
                            className="authSubmitButton"
                            disabled={loading}
                        >
                            {loading
                                ? "Sending..."
                                : "Send Reset Link"
                            }
                        </button>

                    </form>


                    {message && (
                        <p className="resetMessage">
                            {message}
                        </p>
                    )}


                    <button
                        type="button"
                        className="backToLogin"
                        onClick={() => navigate("/")}
                    >
                        ← Back to Login
                    </button>

                </div>

            </div>

            
            {/* IMAGE */}

            <div className="authImage">

                <img
                    src={BackgroundImage}
                    alt="YOSEF's Tutorial Center"
                    id="BG1"
                />

            </div>

        </div>
    );
}

export default ForgotPassword;

