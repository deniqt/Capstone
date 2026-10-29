import { useState } from 'react';
import './register.css'
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import logoImage from '../assets/logo.png'

const GRADES = [
    "Kindergarten",
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Grade 9",
    "Grade 10",
    "Grade 11",
    "Grade 12"
];

const MODE_OPTIONS = [
    { value: "Face-to-Face", label: "Face-to-Face", description: "Traditional in-person classes" },
    { value: "Online", label: "Online", description: "Learn from home via zoom" },
    { value: "Hybrid", label: "Hybrid", description: "Mix of online and in-person" },
];

const TIME_OPTIONS = [
    { value: "Morning", label: "Morning", description: "Sessions before noon (8:00 AM – 12:00 PM)" },
    { value: "Afternoon", label: "Afternoon", description: "Sessions after noon (1:00 PM – 5:00 PM)" },
];

function Register(){

    const navigate = useNavigate();

    const [student, setStudent] = useState({
        FullName: "",
        Email: "",
        DOB: "",
        School: "",
        Grade: "",
        Address: "",
        Username: "",
        Password: "",
    });

    const [guardian, setGuardian] = useState({
        FullName: "",
        Contact: "+63 ",
        Email: "",
        Relationship: "",
    });

    const [preferences, setPreferences] = useState({
        Mode: "",
        Time: "",
    });

    const [documents, setDocuments] = useState({
        Certificate: null,
        GuardianID: null,
    });

    const [enrolledStudent, setEnrolledStudent] = useState(true);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    function handleStudentChange(e) {
        const { name, value } = e.target;
        setStudent((prev) => ({ ...prev, [name]: value }));
    }

    function handleGuardianChange(e) {
        const { name, value } = e.target;
        setGuardian((prev) => ({ ...prev, [name]: value }));
    }

    function selectPreference(field, value) {
        setPreferences((prev) => ({ ...prev, [field]: value }));
    }

    function handleFileChange(key, file) {
        setDocuments((prev) => ({ ...prev, [key]: file || null }));
    }

    function validate() {
        const nextErrors = {};

        if (!student.FullName.trim()) nextErrors.studentFullName = "Full name is required.";
        if (!student.Email.trim()) nextErrors.studentEmail = "Email is required to log in.";
        if (!student.DOB) nextErrors.dob = "Date of birth is required.";
        if (!student.Password) nextErrors.password = "Password is required.";
        else if (student.Password.length < 6) nextErrors.password = "Password must be at least 6 characters.";

        if (!guardian.FullName.trim()) nextErrors.guardianFullName = "Full name is required.";
        if (!guardian.Contact.trim()) nextErrors.guardianContact = "Contact number is required.";
        if (!guardian.Email.trim()) nextErrors.guardianEmail = "Email is required.";
        if (!guardian.Relationship) nextErrors.relationship = "Relationship is required.";

        if (!preferences.Mode) nextErrors.mode = "Select a preferred learning modality.";
        if (!preferences.Time) nextErrors.time = "Select a preferred time of learning.";

        if (enrolledStudent && !documents.Certificate) nextErrors.certificate = "Certificate of Enrollment is required.";
        if (!documents.GuardianID) nextErrors.guardianId = "Valid Guardian ID is required.";

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    async function uploadDocument(file, folder) {
        if (!file) return null;

        const fileExt = file.name.split(".").pop();
        const filePath = `${folder}/${crypto.randomUUID()}.${fileExt}`;

        const { error } = await supabase.storage
            .from("documents")
            .upload(filePath, file);

        if (error) {
            console.error("File upload error:", error.message);
            throw new Error("Could not upload " + file.name + ". " + error.message);
        }

        const { data } = supabase.storage.from("documents").getPublicUrl(filePath);
        return data.publicUrl;
    }

    async function registerUser() {
        const { data, error } = await supabase.auth.signUp({
            email: student.Email.trim(),
            password: student.Password,
        });

        if (error) {
            console.error("Registration error:", error.message);

            const errorMessage = error.message.toLowerCase();

            if (
                errorMessage.includes("already registered") ||
                errorMessage.includes("already exists") ||
                errorMessage.includes("user already registered")
            ) {
                throw new Error(
                    "Email already registered. Please use another email or log in instead."
                );
            }

            throw new Error("Registration failed: " + error.message);
        }

        if (!data.user) {
            throw new Error("Unable to create the student account.");
        }

        return data.user.id;
    }

    async function insertParent() {
        const { data, error } = await supabase
            .from("Parent_Table")
            .insert({
                Parent_Name: guardian.FullName.trim(),
                Parent_Email: guardian.Email.trim(),
                Parent_Phone: guardian.Contact.trim(),
                Parent_Relation: guardian.Relationship,
            })
            .select()
            .single();

        if (error) {
            console.error("Parent insert error:", error.message);
            throw error;
        }

        return data.Parent_ID;
    }

    async function insertOtherDetail(parentID, certificateURL, guardianIdURL) {
        const { data, error } = await supabase
            .from("user_details")
            .insert({
                date_of_birth: student.DOB,
                Address: student.Address,
                school: student.School,
                Grade_Level: student.Grade,
                Parent_ID: parentID,
                Learning_Mode: preferences.Mode,
                Learning_Time: preferences.Time,
                Certificate_URL: certificateURL,
                Guardian_ID_URL: guardianIdURL,
                Enrolled_Student: enrolledStudent,
            })
            .select()
            .single();

        if (error) {
            console.error("User details insert error:", error.message);
            throw error;
        }

        return data.detail_id;
    }

    async function insertUser(authID, detailID) {
        const { data, error } = await supabase
            .from("users")
            .insert({
                Name: student.FullName.trim(),
                Role: "Student",
                Email: student.Email.trim(),
                Username: student.Username.trim() || null,
                detail_id: detailID,
                auth_id: authID,
            });

        if (error) {
            console.log(error.message);
            throw error;
        }

        console.log(data);
    }

    async function handleRegister() {
        if (!validate()) {
            return;
        }

        setSubmitting(true);

        try {
            const certificateURL = await uploadDocument(documents.Certificate, "certificates");
            const guardianIdURL = await uploadDocument(documents.GuardianID, "guardian-ids");

            const authID = await registerUser();
            const parentID = await insertParent();
            const detailID = await insertOtherDetail(parentID, certificateURL, guardianIdURL);
            await insertUser(authID, detailID);

            alert("Registered successfully!");
            navigate("/");
        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="register-page">
            <div className="register-header">
                <div id="logo-container">
                    <img id="landing-logo" src={logoImage || ""} alt="YOSEF Tutorial Center Logo" />
                    <p>YOSEF's Tutorial Center</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                    <button type="button" className="cancel-button" onClick={() => navigate("/landing")}>
                        ← Back to Overview
                    </button>
                    <button type="button" className="confirm-button" style={{ padding: "8px 18px" }} onClick={() => navigate("/")}>
                        Log In
                    </button>
                </div>
            </div>

            <div className="register-body">
                <div className="register-intro">
                    <h1>Student Registration</h1>
                    <p>Fill out the information below to tailor the perfect learning path.</p>
                </div>

                {/* Student Information */}
                <section className="form-card">
                    <div className="form-card-header">
                        <span className="form-icon">👤</span>
                        <h2>Student Information</h2>
                    </div>
                    <hr />

                    <div className="form-grid">
                        <div className="form-field span-2">
                            <label htmlFor="studentFullName">Full Name <span className="required">*</span></label>
                            <input
                                type="text"
                                id="studentFullName"
                                name="FullName"
                                className={`input-style ${errors.studentFullName ? "input-error" : ""}`}
                                placeholder="e.g. Juan Dela Cruz"
                                value={student.FullName}
                                onChange={handleStudentChange}
                            />
                            {errors.studentFullName && <span className="field-error"><span aria-hidden="true">⚠️ </span>{errors.studentFullName}</span>}
                        </div>

                        <div className="form-field">
                            <label htmlFor="studentEmail">Email Address <span className="required">*</span></label>
                            <input
                                type="email"
                                id="studentEmail"
                                name="Email"
                                className={`input-style ${errors.studentEmail ? "input-error" : ""}`}
                                placeholder="e.g. juan@example.com"
                                value={student.Email}
                                onChange={handleStudentChange}
                            />
                            <span className="field-hint">Used to log in.</span>
                            {errors.studentEmail && <span className="field-error"><span aria-hidden="true">⚠️ </span>{errors.studentEmail}</span>}
                        </div>

                        <div className="form-field">
                            <label htmlFor="dob">Date of Birth <span className="required">*</span></label>
                            <input
                                type="date"
                                id="dob"
                                name="DOB"
                                className={`input-style ${errors.dob ? "input-error" : ""}`}
                                value={student.DOB}
                                onChange={handleStudentChange}
                            />
                            {errors.dob && <span className="field-error"><span aria-hidden="true">⚠️ </span>{errors.dob}</span>}
                        </div>

                        <div className="form-field">
                            <label htmlFor="school">School</label>
                            <input
                                type="text"
                                id="school"
                                name="School"
                                className="input-style"
                                placeholder="School"
                                value={student.School}
                                onChange={handleStudentChange}
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="grade">Grade</label>
                            <select
                                id="grade"
                                name="Grade"
                                className="input-style"
                                value={student.Grade}
                                onChange={handleStudentChange}
                            >
                                <option value="">Grade</option>
                                {GRADES.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="address">Address</label>
                            <input
                                type="text"
                                id="address"
                                name="Address"
                                className="input-style"
                                placeholder="Address"
                                value={student.Address}
                                onChange={handleStudentChange}
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="username">Username (Optional)</label>
                            <input
                                type="text"
                                id="username"
                                name="Username"
                                className="input-style"
                                placeholder="Username"
                                value={student.Username}
                                onChange={handleStudentChange}
                            />
                            <span className="field-hint">Just a display name — not used to log in.</span>
                        </div>

                        <div className="form-field">
                            <label htmlFor="password">Password <span className="required">*</span></label>
                            <input
                                type="password"
                                id="password"
                                name="Password"
                                className={`input-style ${errors.password ? "input-error" : ""}`}
                                placeholder="Password"
                                value={student.Password}
                                onChange={handleStudentChange}
                            />
                            {errors.password && <span className="field-error"><span aria-hidden="true">⚠️ </span>{errors.password}</span>}
                        </div>
                    </div>
                </section>

                {/* Guardian Information */}
                <section className="form-card">
                    <div className="form-card-header">
                        <span className="form-icon">🧑‍🤝‍🧑</span>
                        <h2>Guardian Information</h2>
                    </div>
                    <hr />

                    <div className="form-grid">
                        <div className="form-field span-2">
                            <label htmlFor="guardianFullName">Full Name <span className="required">*</span></label>
                            <input
                                type="text"
                                id="guardianFullName"
                                name="FullName"
                                className={`input-style ${errors.guardianFullName ? "input-error" : ""}`}
                                placeholder="e.g. Maria Dela Cruz"
                                value={guardian.FullName}
                                onChange={handleGuardianChange}
                            />
                            {errors.guardianFullName && <span className="field-error"><span aria-hidden="true">⚠️ </span>{errors.guardianFullName}</span>}
                        </div>

                        <div className="form-field">
                            <label htmlFor="guardianContact">Contact Number <span className="required">*</span></label>
                            <input
                                type="text"
                                id="guardianContact"
                                name="Contact"
                                className={`input-style ${errors.guardianContact ? "input-error" : ""}`}
                                placeholder="+63"
                                value={guardian.Contact}
                                onChange={handleGuardianChange}
                            />
                            {errors.guardianContact && <span className="field-error"><span aria-hidden="true">⚠️ </span>{errors.guardianContact}</span>}
                        </div>

                        <div className="form-field">
                            <label htmlFor="guardianEmail">Email Address <span className="required">*</span></label>
                            <input
                                type="email"
                                id="guardianEmail"
                                name="Email"
                                className={`input-style ${errors.guardianEmail ? "input-error" : ""}`}
                                placeholder="e.g. maria@example.com"
                                value={guardian.Email}
                                onChange={handleGuardianChange}
                            />
                            {errors.guardianEmail && <span className="field-error"><span aria-hidden="true">⚠️ </span>{errors.guardianEmail}</span>}
                        </div>

                        <div className="form-field">
                            <label htmlFor="relationship">Relationship to Student <span className="required">*</span></label>
                            <select
                                id="relationship"
                                name="Relationship"
                                className={`input-style ${errors.relationship ? "input-error" : ""}`}
                                value={guardian.Relationship}
                                onChange={handleGuardianChange}
                            >
                                <option value="">Select Relationship</option>
                                <option value="Mother">Mother</option>
                                <option value="Father">Father</option>
                                <option value="Guardian">Guardian</option>
                            </select>
                            {errors.relationship && <span className="field-error"><span aria-hidden="true">⚠️ </span>{errors.relationship}</span>}
                        </div>
                    </div>
                </section>

                {/* Learning Preferences */}
                <section className="form-card">
                    <div className="form-card-header">
                        <span className="form-icon">📖</span>
                        <h2>Learning Preferences</h2>
                    </div>
                    <hr />

                    <div className="preference-group">
                        <label className="preference-label">Preferred Learning Modality <span className="required">*</span></label>
                        <div className="preference-grid">
                            {MODE_OPTIONS.map((option) => (
                                <button
                                    type="button"
                                    key={option.value}
                                    className={`preference-card ${preferences.Mode === option.value ? "selected" : ""}`}
                                    onClick={() => selectPreference("Mode", option.value)}
                                >
                                    <div className="preference-card-top">
                                        <span className="preference-icon">
                                            {option.value === "Face-to-Face" && "🧑‍🤝‍🧑"}
                                            {option.value === "Online" && "💻"}
                                            {option.value === "Hybrid" && "🔁"}
                                        </span>
                                        <span className={`radio-dot ${preferences.Mode === option.value ? "checked" : ""}`} />
                                    </div>
                                    <h3>{option.label}</h3>
                                    <p>{option.description}</p>
                                </button>
                            ))}
                        </div>
                        {errors.mode && <span className="field-error"><span aria-hidden="true">⚠️ </span>{errors.mode}</span>}
                    </div>

                    <div className="preference-group">
                        <label className="preference-label">Preferred Time of Learning <span className="required">*</span></label>
                        <div className="preference-grid">
                            {TIME_OPTIONS.map((option) => (
                                <button
                                    type="button"
                                    key={option.value}
                                    className={`preference-card ${preferences.Time === option.value ? "selected" : ""}`}
                                    onClick={() => selectPreference("Time", option.value)}
                                >
                                    <div className="preference-card-top">
                                        <span className="preference-icon">
                                            {option.value === "Morning" && "🌅"}
                                            {option.value === "Afternoon" && "☀️"}
                                        </span>
                                        <span className={`radio-dot ${preferences.Time === option.value ? "checked" : ""}`} />
                                    </div>
                                    <h3>{option.label}</h3>
                                    <p>{option.description}</p>
                                </button>
                            ))}
                        </div>
                        {errors.time && <span className="field-error"><span aria-hidden="true">⚠️ </span>{errors.time}</span>}
                    </div>
                </section>

                {/* Required Documents */}
                <section className="form-card">
                    <div className="form-card-header">
                        <span className="form-icon">📄</span>
                        <h2>Required Documents</h2>
                    </div>
                    <hr />

                    <div className="document-grid">
                        <div className={`document-box ${errors.certificate ? "input-error" : ""}`}>
                            <span className="document-icon">📎</span>
                            <h3>Certificate of Enrollment</h3>
                            <p>PDF, JPG, or PNG (Max 5MB)</p>
                            <label className="browse-button">
                                Browse File
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    hidden
                                    onChange={(e) => handleFileChange("Certificate", e.target.files[0])}
                                />
                            </label>
                            {documents.Certificate && <span className="file-name">{documents.Certificate.name}</span>}
                        </div>

                        <div className={`document-box ${errors.guardianId ? "input-error" : ""}`}>
                            <span className="document-icon">🪪</span>
                            <h3>Valid Guardian ID</h3>
                            <p>Government issued ID (Max 5MB)</p>
                            <label className="browse-button">
                                Browse File
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    hidden
                                    onChange={(e) => handleFileChange("GuardianID", e.target.files[0])}
                                />
                            </label>
                            {documents.GuardianID && <span className="file-name">{documents.GuardianID.name}</span>}
                        </div>
                    </div>
                    {errors.certificate && <span className="field-error"><span aria-hidden="true">⚠️ </span>{errors.certificate}</span>}
                    {errors.guardianId && <span className="field-error"><span aria-hidden="true">⚠️ </span>{errors.guardianId}</span>}

                    <label className="checkbox-row">
                        <input
                            type="checkbox"
                            checked={enrolledStudent}
                            onChange={(e) => setEnrolledStudent(e.target.checked)}
                        />
                        Enrolled Student?
                    </label>
                </section>

                <div className="register-actions">
                    <button type="button" className="cancel-button" onClick={() => navigate("/landing")}>
                        Cancel
                    </button>
                    <button className="confirm-button" onClick={handleRegister} disabled={submitting}>
                        {submitting ? "Submitting Application..." : "Submit Application"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Register;