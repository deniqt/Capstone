import { Await, useParams } from 'react-router-dom';
import './adminEditProfile.css'
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
function AdminEditProfile(){

    const {id} = useParams();
    const[infos, setInfos] = useState(null);
    const[OtherInfos, setOtherInfos] = useState(null);
    const [tutors, setTutors] = useState([]);
    

    const [image, setImage] = useState(null);
    const [imageFile, setImageFile] = useState(null);

    function handleImageChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        setImage(URL.createObjectURL(file));
        setImageFile(file);
    }

    function handleInfoChange(e) {
    const { name, value } = e.target;

    setInfos({
        ...infos,
        [name]: value
    });

    }

    function handleOtherInfoChange(e) {
    const { name, value } = e.target;

    setOtherInfos({
        ...OtherInfos,
        [name]: value
    });
    }

    async function saveChanges() {

    let imageUrl = OtherInfos.profile_url;
    

    if (imageFile) {

        const fileName = `${Date.now()}-${imageFile.name}`;

        const { error } = await supabase.storage
            .from("profiles")
            .upload(fileName, imageFile);

        if (error) {
            console.log(error);
            return;
        }

        const { data } = supabase.storage
            .from("profiles")
            .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
    }

        const result = await supabase
        .from("user_details")
        .update({
            profile_url: imageUrl
        })
        .eq("detail_id", infos.detail_id);

    }

    async function saveAllInfo() {

        const { error: userError } = await supabase
        .from("users")
        .update({
        Name: infos.Name,
        Email: infos.Email,
        Role: infos.Role
        })
        .eq("id", infos.id);

        const { error: detailsError } = await supabase
        .from("user_details")
        .update({
        school: OtherInfos.school,
        Address: OtherInfos.Address,
        date_of_birth: OtherInfos.date_of_birth,
        Tutor_ID: OtherInfos.Tutor_ID,
        Grade_Level: OtherInfos.Grade_Level,
        Subjects: OtherInfos.Subjects
         })
        .eq("detail_id", infos.detail_id);
        
    }

    async function handleSave() {
    const confirmed = window.confirm("Are you sure you want to save the changes?");

    if (!confirmed) return;

    await saveChanges();
    await saveAllInfo();

    alert("Changes saved successfully!");
}

    useEffect(()=>{
       getTutors()
        getInfo();
    },[]);

    async function getInfo(){
         const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

        if (!error) {
            setInfos(data);
            getOtherInfo(data.detail_id)
        }
    }

    async function getOtherInfo(detailID) {
        const{data, error} = await supabase
        .from("user_details")
        .select("*")
        .eq("detail_id", detailID)
        .single();

        
         if (!error) {
            setOtherInfos(data);
            
        }
    }


    async function getTutors() {
    const { data, error } = await supabase
        .from("users")
        .select("id, Name")
        .eq("Role", "Tutor");

    if (error) {
        console.log(error);
    } else {
        setTutors(data);
    }
}
    return(
        <>
        
         <h1 id="SATTitle">Student & Teacher</h1>
         <div className='buttonPanel'>
            <p>
                Edit User: {infos?.Name}
            </p>
            <div className='buttonBox'>
                <button style={{
                    marginRight:"5px"
                }}>Cancel</button>

                <button
                onClick={()=>{
                   handleSave();
                }}
                >Save Changes</button>
              
            </div>

         </div>

        {/* Lower Panel whole box */}
         <div className='info-panel'>
                {/* personal information whole box */}
                <div className='personal-box'>
                    <h3 > Personal Information</h3>
                        <div className='picture-panel'>
                            {/* Preview */}
                        <img
                            src={image || OtherInfos?.profile_url|| "https://placehold.co/150x150?text=Profile"}
                            alt="Profile"
                            style={{
                            width: "50px",
                            height: "50px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "2px solid #ccc",
                            }}
                        />
                        <div id='profile-label-box'>

                            <label htmlFor="profile-upload">Profile Picture</label>

                        {/* Upload Button */}
                        <br/>
                        <input
                          id="profile-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                        />
                        </div>
                        </div>
                         
                         
                        {/* personal information input box */}
                    <div id='personalInfo-box'>
                            <div className='labelbox'>
                             <label htmlFor="name">Full Name</label>
                            
                            <input
                            type="text"
                            id="name"
                            name='Name'
                            className='input-style'
                            value={infos?.Name||""}   
                            onChange={handleInfoChange}
                            />
                    </div>
                    
                    <div className='labelbox'>
                        <label htmlFor="email">Email</label>
                    
                        <input
                        type="text"
                        id="email"
                        name='Email'
                        className='input-style'
                        value={infos?.Email||""}   
                        onChange={handleInfoChange}
                         />
                    </div>
                    <div className='labelbox'>
                        <label htmlFor="DOB">Date Of Birth</label>
                        <input
                        type='date'
                        name='date_of_birth'
                        className='input-style'
                        id="DOB"
                        value={OtherInfos?.date_of_birth||""} 
                        onChange={handleOtherInfoChange}  
                         />
                    </div>
                    <div className='labelbox'>
                        <label htmlFor="school">School</label>
                        <input
                        type='text'
                        name='school'
                        className='input-style'
                        id="school"
                        value={OtherInfos?.school||""}   
                        onChange={handleOtherInfoChange}  
                         />

                    </div>
                    <div className='labelbox'>
                        <label htmlFor="address">Address</label>
                        <input
                        type='text'
                        name='Address'
                        className='input-style'
                        id="address"
                        value={OtherInfos?.Address||""}
                        onChange={handleOtherInfoChange}     
                         />
                    </div>
                    </div>   
                         
                </div>
                
                {/* Account Settings Panel */}
                <div className='Account-Settings-Panel'>
                    <h3>Account Settings</h3>
                    <div id='Account-Settings-box'>

                        <div className='labelbox'>
                        <label htmlFor="role">Role</label>
                        <input
                        type='text'
                        name='Role'
                        className='input-style'
                        id="role"
                        value={infos?.Role||""} 
                        onChange={handleInfoChange}    
                         />

                    </div>

                    <div className='labelbox'>
                        <label htmlFor="tutor">Tutor</label>
                            <select
                                name="Tutor_ID"
                                id="tutor"
                                className="input-style"
                                value={OtherInfos?.Tutor_ID || ""}
                                onChange={handleOtherInfoChange}
                            >
                                <option value="">Select a Tutor</option>

                                {tutors.map((tutor) => (
                                    <option key={tutor.id} value={tutor.id}>
                                        {tutor.Name}
                                    </option>
                                ))}
                            </select>
                    </div>

                    <div className='labelbox'>
                        <label htmlFor="GradeLevel">Grade Level</label>
                        <input
                        type='text'
                        name='Grade_Level'
                        className='input-style'
                        id="GradeLevel"
                        value={OtherInfos?.Grade_Level||""}
                        onChange={handleOtherInfoChange}     
                         />

                    </div>

                    <div className='labelbox'>
                        <label htmlFor="Subjects">Subjects</label>
                        <input
                        type='text'
                        name='Subjects'
                        className='input-style'
                        id="Subjects"
                        value={OtherInfos?.Subjects||""}
                        onChange={handleOtherInfoChange}     
                         />

                    </div>

                    <div className='labelbox'>
                        <label htmlFor="Username">Username</label>
                        <input
                        type='text'
                        name='Email'
                        className='input-style'
                        id="Username"
                        value={infos?.Email||""}
                        onChange={handleInfoChange}     
                         />

                    </div>

                    <div className='labelbox'>
                        <label htmlFor="password">password</label>
                        <input
                        type='password'
                        name='Password'
                        className='input-style'
                        id="password"
                        value={infos?.Password||""}
                        onChange={handleInfoChange}     
                         />

                    </div>

                    <div className='labelbox'>
                        <label htmlFor="JoinedDate">Joined Date</label>
                        <input
                        type='date'
                        name='Joined'
                        className='input-style'
                        id="JoinedDate"
                        value={infos?.Joined||""}
                        onChange={handleInfoChange}     
                         />

                    </div>
                    </div>
                </div>

         </div>
        </>
    );
}

export default AdminEditProfile