import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./adminEditProfile.css";
import { supabase } from "../../lib/supabase";

function AdminEditProfile() {

    const { id } = useParams();
    const navigate = useNavigate();

    const [infos, setInfos] = useState(null);
    const [otherInfos, setOtherInfos] = useState(null);
    const [tutors, setTutors] = useState([]);

    const [image, setImage] = useState(null);
    const [imageFile, setImageFile] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);


    // ==========================================
    // LOAD DATA
    // ==========================================

    useEffect(() => {

        if (!id) {
            return;
        }

        loadProfile();
        getTutors();

    }, [id]);


    // ==========================================
    // LOAD USER + USER DETAILS
    // ==========================================

    async function loadProfile() {

        try {

            setLoading(true);

            // --------------------------------------
            // GET USER
            // --------------------------------------

            const {
                data: userData,
                error: userError
            } = await supabase
                .from("users")
                .select("*")
                .eq("id", id)
                .single();


            if (userError) {

                console.error(
                    "User loading error:",
                    userError
                );

                alert("Failed to load user.");

                return;

            }


            if (!userData) {

                alert("User not found.");

                return;

            }


            setInfos(userData);


            // --------------------------------------
            // CHECK DETAIL ID
            // --------------------------------------

            if (!userData.detail_id) {

                console.error(
                    "User has no detail_id:",
                    userData
                );

                setOtherInfos(null);

                return;

            }


            // --------------------------------------
            // GET USER DETAILS
            // --------------------------------------

            const {
                data: detailData,
                error: detailError
            } = await supabase
                .from("user_details")
                .select("*")
                .eq(
                    "detail_id",
                    userData.detail_id
                )
                .single();


            if (detailError) {

                console.error(
                    "Profile loading error:",
                    detailError
                );

                alert(
                    "Failed to load profile information."
                );

                return;

            }


            setOtherInfos(detailData);

        } catch (error) {

            console.error(
                "Load profile error:",
                error
            );

            alert(
                error.message ||
                "Failed to load profile."
            );

        } finally {

            setLoading(false);

        }

    }


    // ==========================================
    // GET TUTORS
    // ==========================================

    async function getTutors() {

        const {
            data,
            error
        } = await supabase
            .from("users")
            .select("id, Name")
            .eq("Role", "Tutor")
            .order("Name", {
                ascending: true
            });


        if (error) {

            console.error(
                "Tutor loading error:",
                error
            );

            return;

        }


        setTutors(data || []);

    }


    // ==========================================
    // USER INFORMATION CHANGE
    // ==========================================

    function handleInfoChange(event) {

        const {
            name,
            value
        } = event.target;


        setInfos(prev => ({

            ...prev,

            [name]: value

        }));

    }


    // ==========================================
    // OTHER INFORMATION CHANGE
    // ==========================================

    function handleOtherInfoChange(event) {

        const {
            name,
            value
        } = event.target;


        setOtherInfos(prev => ({

            ...prev,

            [name]: value

        }));

    }


    // ==========================================
    // IMAGE CHANGE
    // ==========================================

    function handleImageChange(event) {

        const file =
            event.target.files?.[0];


        if (!file) {
            return;
        }


        setImageFile(file);

        setImage(
            URL.createObjectURL(file)
        );

    }


    // ==========================================
    // SAVE PROFILE IMAGE
    // ==========================================

    async function uploadProfileImage() {

        if (!imageFile) {

            return otherInfos?.profile_url || null;

        }


        const file =
            imageFile;


        const fileExt =
            file.name.split(".").pop();


        const fileName =
            `${crypto.randomUUID()}.${fileExt}`;


        const filePath =
            `profiles/${fileName}`;


        const {
            error: uploadError
        } = await supabase.storage
            .from("profiles")
            .upload(
                filePath,
                file,
                {
                    upsert: false
                }
            );


        if (uploadError) {

            throw uploadError;

        }


        const {
            data
        } = supabase.storage
            .from("profiles")
            .getPublicUrl(
                filePath
            );


        return data.publicUrl;

    }


    // ==========================================
    // SAVE CHANGES
    // ==========================================

    async function handleSave() {

        if (!infos || !otherInfos) {

            alert(
                "Profile information is not loaded yet."
            );

            return;

        }


        const confirmed =
            window.confirm(
                "Are you sure you want to save the changes?"
            );


        if (!confirmed) {
            return;
        }


        try {

            setSaving(true);


            // ======================================
            // PROFILE IMAGE
            // ======================================

            const imageUrl =
                await uploadProfileImage();


            // ======================================
            // UPDATE USERS
            // ======================================

            const {
                error: userError
            } = await supabase
                .from("users")
                .update({

                    Name:
                        infos.Name,

                    Email:
                        infos.Email,

                    Role:
                        infos.Role,

                    Joined:
                        infos.Joined,

                    Status:
                        infos.Status

                })
                .eq(
                    "id",
                    infos.id
                );


            if (userError) {

                throw userError;

            }


            // ======================================
            // UPDATE USER DETAILS
            // ======================================

            const {
                error: detailError
            } = await supabase
                .from("user_details")
                .update({

                    profile_url:
                        imageUrl,

                    school:
                        otherInfos.school,

                    Address:
                        otherInfos.Address,

                    date_of_birth:
                        otherInfos.date_of_birth,

                    Tutor_ID:
                        otherInfos.Tutor_ID
                            ? Number(
                                otherInfos.Tutor_ID
                            )
                            : null,

                    Grade_Level:
                        otherInfos.Grade_Level,


                    phone_number:
                        otherInfos.phone_number

                })
                .eq(
                    "detail_id",
                    otherInfos.detail_id
                );


            if (detailError) {

                throw detailError;

            }


            // ======================================
            // UPDATE LOCAL STATE
            // ======================================

            setOtherInfos(prev => ({

                ...prev,

                profile_url:
                    imageUrl

            }));


            setImageFile(null);


            alert(
                "Changes saved successfully!"
            );


        } catch (error) {

            console.error(
                "Save profile error:",
                error
            );


            alert(
                error.message ||
                "Failed to save changes."
            );

        } finally {

            setSaving(false);

        }

    }


    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {

        return (

            <div className="admin-edit-profile">

                <h1 id="SATTitle">
                    Student & Teacher
                </h1>

                <p>
                    Loading profile...
                </p>

            </div>

        );

    }


    // ==========================================
    // USER NOT FOUND
    // ==========================================

    if (!infos) {

        return (

            <div className="admin-edit-profile">

                <h1 id="SATTitle">
                    Student & Teacher
                </h1>

                <p>
                    User not found.
                </p>

                <button
                    onClick={() =>
                        navigate("/admin/StudentAndTutor")
                    }
                >
                    Back
                </button>

            </div>

        );

    }


    // ==========================================
    // RENDER
    // ==========================================

    return (

        <>

            <h1 id="SATTitle">
                Student & Teacher
            </h1>


            {/* ==================================
                HEADER
            ================================== */}

            <div className="buttonPanel">

                <p>
                    Edit User: {infos.Name}
                </p>


                <div className="buttonBox">

                    <button
                        style={{
                            marginRight: "5px"
                        }}
                        onClick={() =>
                            navigate(
                                "/admin/student-and-tutor"
                            )
                        }
                        disabled={saving}
                    >
                        Cancel
                    </button>


                    <button
                        onClick={handleSave}
                        disabled={
                            saving ||
                            !otherInfos
                        }
                    >
                        {saving
                            ? "Saving..."
                            : "Save Changes"
                        }
                    </button>

                </div>

            </div>


            {/* ==================================
                PROFILE
            ================================== */}

            <div className="info-panel">


                {/* ==================================
                    PERSONAL INFORMATION
                ================================== */}

                <div className="personal-box">

                    <h3>
                        Personal Information
                    </h3>


                    {/* PROFILE PICTURE */}

                    <div className="picture-panel">

                        <img
                            src={
                                image ||
                                otherInfos?.profile_url ||
                                "https://placehold.co/150x150?text=Profile"
                            }
                            alt="Profile"
                            style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: "2px solid #ccc"
                            }}
                        />


                        <div id="profile-label-box">

                            <label htmlFor="profile-upload">
                                Profile Picture
                            </label>

                            <br />

                            <input
                                id="profile-upload"
                                type="file"
                                accept="image/*"
                                onChange={
                                    handleImageChange
                                }
                                disabled={saving}
                            />

                        </div>

                    </div>


                    {/* PERSONAL FIELDS */}

                    <div id="personalInfo-box">


                        {/* FULL NAME */}

                        <div className="labelbox">

                            <label>
                                Full Name
                            </label>

                            <input
                                type="text"
                                name="Name"
                                className="input-style"
                                value={
                                    infos.Name || ""
                                }
                                onChange={
                                    handleInfoChange
                                }
                            />

                        </div>


                        {/* EMAIL */}

                        <div className="labelbox">

                            <label>
                                Email
                            </label>

                            <input
                                type="email"
                                name="Email"
                                className="input-style"
                                value={
                                    infos.Email || ""
                                }
                                onChange={
                                    handleInfoChange
                                }
                            />

                        </div>


                        {/* DATE OF BIRTH */}

                        <div className="labelbox">

                            <label>
                                Date Of Birth
                            </label>

                            <input
                                type="date"
                                name="date_of_birth"
                                className="input-style"
                                value={
                                    otherInfos?.date_of_birth ||
                                    ""
                                }
                                onChange={
                                    handleOtherInfoChange
                                }
                            />

                        </div>


                        {/* SCHOOL */}

                        <div className="labelbox">

                            <label>
                                School
                            </label>

                            <input
                                type="text"
                                name="school"
                                className="input-style"
                                value={
                                    otherInfos?.school ||
                                    ""
                                }
                                onChange={
                                    handleOtherInfoChange
                                }
                            />

                        </div>


                        {/* ADDRESS */}

                        <div className="labelbox">

                            <label>
                                Address
                            </label>

                            <input
                                type="text"
                                name="Address"
                                className="input-style"
                                value={
                                    otherInfos?.Address ||
                                    ""
                                }
                                onChange={
                                    handleOtherInfoChange
                                }
                            />

                        </div>


                        {/* PHONE */}

                        <div className="labelbox">

                            <label>
                                Phone Number
                            </label>

                            <input
                                type="text"
                                name="phone_number"
                                className="input-style"
                                value={
                                    otherInfos?.phone_number ||
                                    ""
                                }
                                onChange={
                                    handleOtherInfoChange
                                }
                            />

                        </div>

                    </div>

                </div>


                {/* ==================================
                    ACCOUNT SETTINGS
                ================================== */}

                <div className="Account-Settings-Panel">

                    <h3>
                        Account Settings
                    </h3>


                    <div id="Account-Settings-box">


                        {/* ROLE */}

                        <div className="labelbox">

                            <label>
                                Role
                            </label>

                            <input
                                type="text"
                                name="Role"
                                className="input-style"
                                value={
                                    infos.Role || ""
                                }
                                disabled
                            />

                        </div>


                        {/* STATUS */}

                        <div className="labelbox">

                            <label>
                                Status
                            </label>

                            <select
                                name="Status"
                                className="input-style"
                                value={
                                    infos.Status || "Inactive"
                                }
                                onChange={
                                    handleInfoChange
                                }
                            >

                                <option value="Active">
                                    Active
                                </option>

                                <option value="Inactive">
                                    Inactive
                                </option>

                            </select>

                        </div>


                        {/* TUTOR */}

                        {infos.Role === "Student" && (

                            <div className="labelbox">

                                <label>
                                    Tutor
                                </label>

                                <select
                                    name="Tutor_ID"
                                    className="input-style"
                                    value={
                                        otherInfos?.Tutor_ID ||
                                        ""
                                    }
                                    onChange={
                                        handleOtherInfoChange
                                    }
                                >

                                    <option value="">
                                        Select a Tutor
                                    </option>


                                    {tutors.map(
                                        tutor => (

                                            <option
                                                key={
                                                    tutor.id
                                                }
                                                value={
                                                    tutor.id
                                                }
                                            >
                                                {
                                                    tutor.Name
                                                }
                                            </option>

                                        )
                                    )}

                                </select>

                            </div>

                        )}


                        {/* GRADE LEVEL */}

                        {infos.Role === "Student" && (

                            <div className="labelbox">

                                <label>
                                    Grade Level
                                </label>

                                <input
                                    type="text"
                                    name="Grade_Level"
                                    className="input-style"
                                    value={
                                        otherInfos?.Grade_Level ||
                                        ""
                                    }
                                    onChange={
                                        handleOtherInfoChange
                                    }
                                />

                            </div>

                        )}



                        {/* USERNAME */}

                        <div className="labelbox">

                            <label>
                                Username
                            </label>

                            <input
                                type="text"
                                className="input-style"
                                value={
                                    infos.Email || ""
                                }
                                disabled
                            />

                        </div>


                        {/* PASSWORD */}

                        <div className="labelbox">

                            <label>
                                Password
                            </label>

                            <input
                                type="password"
                                className="input-style"
                                value="********"
                                disabled
                            />

                            <small>
                                Password cannot be edited here.
                            </small>

                        </div>


                        {/* JOINED */}

                        <div className="labelbox">

                            <label>
                                Joined Date
                            </label>

                            <input
                                type="date"
                                name="Joined"
                                className="input-style"
                                value={
                                    infos.Joined || ""
                                }
                                onChange={
                                    handleInfoChange
                                }
                            />

                        </div>

                    </div>

                </div>

            </div>

        </>

    );

}

export default AdminEditProfile;