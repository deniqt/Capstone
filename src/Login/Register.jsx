import { useState } from 'react';
import './register.css'
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

function Register(){

    const[userLogin, setUserLogin] = useState({
          Email: "",
          Password:""
    });

     const[info, setInfo] = useState({
          Name: "",
          Role:"Student",
    });

    const[otherInfo, setOtherInfo] = useState({
         detail_id:"",
          DOB:"",
          Address:""
    });

    const navigate = useNavigate();


    function handleUserChange(e) {
    const { name, value } = e.target;

    setUserLogin((prev) => ({
        ...prev,
        [name]: value,
    }));
    }

    function handleUserInfoChange(e) {
    const { name, value } = e.target;

    setInfo((prev) => ({
        ...prev,
        [name]: value,
    }));
    }

    function handleUserOtherInfoChange(e) {
    const { name, value } = e.target;

    setOtherInfo((prev) => ({
        ...prev,
        [name]: value,
    }));

    }

    async function registerUser() {
        const {data, error} = await supabase.auth.signUp({
            email: userLogin.Email,
            password: userLogin.Password,
        });

        if(error){
            console.log(error.message);
             throw error;
        }

        return data.user.id;
    }

     async function insertOtherDetail() {
        const{data, error} = await supabase
        .from("user_details")
        .insert({
            date_of_birth:otherInfo.DOB,
            Address:otherInfo.Address
        })
        .select()
        .single()
        ;

        if(error){
            console.log(error.message)
              throw error;
        }
       
        console.log(data)
         console.log(data.detail_id)
        return data.detail_id;
        
    }

    async function insertUser(AuthID, DetailID) {
        const{data, error} = await supabase
        .from("users")
        .insert({
            Name:info.Name,
            Role:info.Role,
            Email:userLogin.Email,
            detail_id:DetailID,
            auth_id:AuthID
        });

        if(error){
            console.log(error.message)
              throw error;
        }

        console.log(data)
    }

   async function handleRegister() {
        try {
            if (
                !userLogin.Email ||
                !userLogin.Password ||
                !info.Name ||
                !otherInfo.DOB ||
                !otherInfo.Address
            ) {
                alert("Please complete all required fields.");
                return;
            }

            const authID = await registerUser();

            const detailID = await insertOtherDetail();

            await insertUser(authID, detailID);

            alert("Registered!");

            navigate("/");

        } catch (err) {
            console.log(err.message);
        }
    }
    return(
        <>
        <h1>Student Registration</h1>

        <div>
            <h1>Login Details</h1>
            <div className="login-panel">
                 
                <div className='login-box'>
                    <label htmlFor="email">Email</label>
                    <br/>
                        <input
                        type="email"
                        id="email"
                        name='Email'
                        className='input-style'
                        value={userLogin.Email||""}
                        onChange={handleUserChange}
                         />
                </div>

                <div className='login-box'>
                    <label htmlFor="password">Password</label>
                    <br/>
                        <input
                        type="password"
                        id="password"
                        name='Password'
                        className='input-style'
                        value={userLogin.Password||""}
                        onChange={handleUserChange}
                         />
                </div>
                
            </div>

        </div>

        <div>
            <h1>Student Information</h1>

            <div className="login-panel">
                 
                <div className='login-box'>
                    <label htmlFor="Name">Full Name</label>
                    <br/>
                        <input
                        type="text"
                        id="Name"
                        name='Name'
                        className='input-style'
                        value={info.Name||""}
                        onChange={handleUserInfoChange}

                         />
                </div>

                <div className='login-box'>
                    <label htmlFor="DOB">Date Of Birth</label>
                    <br/>
                        <input
                        type="date"
                        id="DOB"
                        name='DOB'
                        className='input-style'
                        value={otherInfo.DOB||""}
                        onChange={handleUserOtherInfoChange}
                         />
                </div>

                <div className='login-box'>
                    <label htmlFor="address">Address</label>
                    <br/>
                        <input
                        type="text"
                        id="address"
                        name='Address'
                        className='input-style'
                        value={otherInfo.Address||""}
                        onChange={handleUserOtherInfoChange}
                         />
                </div>
                
            </div>

            

        </div>

        <div>
            <h1>Guardian Information</h1>

            <div className="login-panel">
                 
                <div className='login-box'>
                    <label htmlFor="ParentName">Full Name</label>
                    <br/>
                        <input
                        type="text"
                        id="ParentName"
                        name='Name'
                        className='input-style'
                        value={""}
                         />
                </div>

                <div className='login-box'>
                    <label htmlFor="Contact">Contact Number</label>
                    <br/>
                        <input
                        type="text"
                        id="Contact"
                        name='Contact-Number'
                        className='input-style'
                        value={""}
                         />
                </div>

                <div className='login-box'>
                    <label htmlFor="address">Relationship</label>
                    <br/>
                        <select
                        id="address"
                        name='address'
                        className='input-style'
                         >
                            <option value="">Select Relationship</option>
                            <option value="Mother">Mother</option>
                            <option value="Father">Father</option>
                            
                            </select>
                </div>
                
            </div>

        </div>

        <div>
            <h1>Learning Preference</h1>

        </div>

         <div>
            <h1>Required Document</h1>

        </div>

      <button onClick={handleRegister}>
        Register
      </button>

        </>
    );
}

export default Register;