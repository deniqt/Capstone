import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./login.css";

function ResetPassword() {

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    async function handleResetPassword(e) {

        e.preventDefault();

        if (!password || !confirmPassword) {
            setMessage("Please fill in both fields.");
            return;
        }

        if (password !== confirmPassword) {
            setMessage("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setMessage(
                "Password must be at least 6 characters."
            );
            return;
        }

        setLoading(true);
        setMessage("");

        const { error } = await supabase.auth.updateUser({
            password: password,
        });

        setLoading(false);

        if (error) {
            setMessage(error.message);
            return;
        }

        setMessage(
            "Your password has been successfully changed."
        );

        setTimeout(() => {
            navigate("/");
        }, 2000);
    }

    return (
        <div className="forgotPage">

            <div className="forgotCard">

                <h1>Reset Password</h1>

                <p>
                    Enter your new password below.
                </p>

                <form onSubmit={handleResetPassword}>

                    <input
                        type="password"
                        placeholder="New password"
                        value={password}
                        onChange={(e) =>
                            setPassword(e.target.value)
                        }
                    />

                    <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) =>
                            setConfirmPassword(e.target.value)
                        }
                    />

                    <button
                        type="submit"
                        disabled={loading}
                    >
                        {loading
                            ? "Updating..."
                            : "Update Password"
                        }
                    </button>

                </form>

                {message && (
                    <p className="resetMessage">
                        {message}
                    </p>
                )}

            </div>

        </div>
    );
}

export default ResetPassword;