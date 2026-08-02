import { useState } from 'react';
import './login.css';
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BackroundImage from "../assets/image 7.png"

function Login() {

    const[email, setEmail] = useState('');
    const[password, setPassword] = useState('');
    const[user, setUser] = useState();
    const navigate = useNavigate();

    async function handleLogin() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setEmail("");
      setPassword("");
      return;
    }

    const authUser = data.user;

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

    // Prevent inactive users from entering
    if (userData.Status !== "Active") {
      alert("Your account has been deactivated. Please contact the administrator.");
      await supabase.auth.signOut();
      setEmail("");
      setPassword("");
      return;
    }

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
    <>
      <div className="mainPanel">
        <div className="imageBackground">
          <img src={BackroundImage} id="ImageLogin" alt="Login" />
        </div>

        <div className="textfieldPanel">
          <h1 id='loginTitle'>
            Welcome to<br/>
            YOSEF's Tutorial Center
          </h1>

          <div className='loginPanel'>
            <h1>
              Login
            </h1>

            <input
              type="email"
              placeholder='Email'
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              onKeyDown={(e) => {
              if (e.key === "Enter") {
            handleLogin();
            }
            }}
            />

             <input
              type="password"
              placeholder='Password'
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              onKeyDown={(e) => {
              if (e.key === "Enter") {
            handleLogin();
            }
            }}
            />

            <button type="submit"
            
            onClick={()=>{
              handleLogin()

              
              
            }}
            >Login</button>

            <a>Don't Have Account? <button onClick={()=>navigate('/landing')}>click here</button></a>
              
            
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;