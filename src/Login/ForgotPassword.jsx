import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
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
                redirectTo: `${window.location.origin}/reset-password`,
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
        <div className="forgotPage">

            <div className="forgotCard">

                <h1>Forgot Password?</h1>

                <p>
                    Enter your email address and we'll send you
                    a link to reset your password.
                </p>

                <form onSubmit={handleForgotPassword}>

                    <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <button
                        type="submit"
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
                    Back to Login
                </button>

            </div>

        </div>
    );
}

export default ForgotPassword;