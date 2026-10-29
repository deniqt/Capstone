import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './landingPage.css';
import logoImage from '../assets/logo.png';
import heroImage from '../assets/landing.png';

function LandingPage() {
    const navigate = useNavigate();
    const [activeModal, setActiveModal] = useState(null);

    return (
        <div className="landing-wrapper">
            {/* STICKY HEADER */}
            <header className="Landing-header">
                <div
                    id="logo-container"
                    role="button"
                    tabIndex={0}
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    aria-label="Scroll to top of YOSEF Tutorial Center"
                >
                    <img id="landing-logo" src={logoImage || ""} alt="YOSEF Tutorial Center Logo" />
                    <p>YOSEF's Tutorial Center</p>
                </div>

                <div className="landing-nav-actions">
                    <button
                        type="button"
                        className="login-nav-button"
                        onClick={() => navigate("/")}
                    >
                        Log In
                    </button>
                    <button
                        type="button"
                        className="apply-button"
                        onClick={() => navigate("/register")}
                    >
                        Apply Now
                    </button>
                </div>
            </header>

            {/* HERO SECTION */}
            <section className="hero-section">
                <div className="hero-copy">
                    <span className="hero-eyebrow">Exclusively for kindergarteners - high school students</span>
                    <h1 className="hero-title">
                        Personalized 1-on-1 tutoring that builds real skills and confidence.
                    </h1>
                    <p className="hero-description">
                        YOSEF Tutorial Center connects students with caring, patient tutors. Choose between in-person, online, or hybrid sessions designed to match your child's pace and schedule.
                    </p>

                    <div className="hero-tags">
                        <span className="hero-tag">1-on-1 Personalized Tutoring</span>
                        <span className="hero-tag">Face-to-Face, Online & Hybrid</span>
                        <span className="hero-tag">Morning & Afternoon Sessions</span>
                    </div>

                    <div className="hero-actions">
                        <button
                            type="button"
                            className="apply-button hero-cta-btn"
                            onClick={() => navigate("/register")}
                        >
                            Apply for Enrollment
                        </button>
                        <button
                            type="button"
                            className="login-nav-button hero-login-btn"
                            onClick={() => navigate("/")}
                        >
                            Student / Tutor Login
                        </button>
                    </div>
                </div>

                <div className="hero-media">
                    <img
                        id="hero-image"
                        src={heroImage}
                        alt="YOSEF Tutorial Center review session in full swing with teachers and students"
                        width="768"
                        height="1024"
                        fetchPriority="high"
                    />

                    <div className="hero-stats">
                        <div className="hero-stat">
                            <div className="hero-stat-icon" aria-hidden="true">🎓</div>
                            <h3>Kindergarten – High School</h3>
                            <p>Tailored curriculum for kindergarteners to high school students</p>
                        </div>
                        <div className="hero-stat">
                            <div className="hero-stat-icon" aria-hidden="true">👤</div>
                            <h3>1-on-1 Tutoring</h3>
                            <p>Private sessions dedicated exclusively to your child</p>
                        </div>
                        <div className="hero-stat">
                            <div className="hero-stat-icon" aria-hidden="true">💻</div>
                            <h3>3 Flexible Modes</h3>
                            <p>Face-to-Face, Online, or flexible Hybrid options</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* REGISTRATION CHECKLIST / WHAT TO PREPARE */}
            <section className="requirements-section">
                <div className="requirements-container">
                    <span className="section-eyebrow">Enrollment Requirements</span>
                    <h2 className="section-title">What you'll need to apply</h2>
                    <p className="section-subtitle">
                        To help us process and approve your student's account promptly, please have the following ready when completing the online registration.
                    </p>

                    <div className="requirements-grid">
                        <div className="requirement-card">
                            <div className="requirement-icon" aria-hidden="true">👤</div>
                            <h3>Student Information</h3>
                            <p>Full legal name, active email for login, date of birth, current school, and grade level (Kindergarten through High School).</p>
                        </div>

                        <div className="requirement-card">
                            <div className="requirement-icon" aria-hidden="true">🧑‍🤝‍🧑</div>
                            <h3>Parent / Guardian Contact</h3>
                            <p>Guardian full name, active Philippine mobile number (+63), email address, and relationship to the student.</p>
                        </div>

                        <div className="requirement-card">
                            <div className="requirement-icon" aria-hidden="true">🪪</div>
                            <h3>Valid Guardian ID</h3>
                            <p>A government-issued ID (Passport, Driver's License, UMID, National ID, etc.) in JPG, PNG, or PDF format.</p>
                        </div>

                        <div className="requirement-card">
                            <div className="requirement-icon" aria-hidden="true">📎</div>
                            <h3>Certificate of Enrollment</h3>
                            <p>School enrollment certificate or current report card for currently enrolled students (Max 5MB file size).</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* WHY CHOOSE YOSEF */}
            <section className="why-section">
                <span className="section-eyebrow">Why Families Choose Us</span>
                <h2 className="section-title">A focused learning environment made for growing minds</h2>
                <p className="section-subtitle">
                    Every student learns differently. We offer a structured, encouraging tutorial experience with clear scheduling and direct tutor communication.
                </p>

                <div className="why-grid">
                    <div className="why-card">
                        <div className="why-icon" aria-hidden="true">🎯</div>
                        <h3>1-on-1 Dedicated Tutoring</h3>
                        <p>No crowded classrooms. Each session is private between the tutor and the student, allowing full focus on areas that need reinforcement.</p>
                    </div>

                    <div className="why-card">
                        <div className="why-icon" aria-hidden="true">🧑‍🏫</div>
                        <h3>Qualified, Patient Tutors</h3>
                        <p>Our educators explain difficult concepts clearly, guide homework, and adapt teaching techniques to each child's learning pace.</p>
                    </div>

                    <div className="why-card">
                        <div className="why-icon" aria-hidden="true">🕒</div>
                        <h3>Flexible Timing</h3>
                        <p>Choose the time block that fits your routine: Morning or Afternoon sessions, accommodating regular school hours.</p>
                    </div>

                    <div className="why-card">
                        <div className="why-icon" aria-hidden="true">💻</div>
                        <h3>In-Person or Online</h3>
                        <p>Enjoy face-to-face sessions at our center or learn comfortably from home via Zoom and Google Meet with full digital learning materials.</p>
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="how-section">
                <span className="section-eyebrow">How It Works</span>
                <h2 className="section-title">Three simple steps to get started</h2>
                <p className="section-subtitle">
                    Our enrollment process is clear, transparent, and structured to get your child learning quickly.
                </p>

                <div className="how-grid">
                    <div className="how-step">
                        <span className="how-number">1</span>
                        <h3>Submit Registration</h3>
                        <p>Complete the student registration form with your preferred learning modality (Face-to-Face, Online, or Hybrid) and time slot.</p>
                    </div>
                    <div className="how-step">
                        <span className="how-number">2</span>
                        <h3>Upload Documents</h3>
                        <p>Attach the required guardian ID and student enrollment certificate for administrative verification and security.</p>
                    </div>
                    <div className="how-step">
                        <span className="how-number">3</span>
                        <h3>Get Matched & Begin</h3>
                        <p>Once verified, the admin approves your account and assigns a dedicated tutor to schedule your first 1-on-1 session.</p>
                    </div>
                </div>
            </section>

            {/* CALL TO ACTION */}
            <section className="cta-section">
                <div className="cta-box">
                    <h2>Ready to help your child succeed?</h2>
                    <p>Apply today for Kindergarten – High School tutoring and give your student the personalized support they need to thrive.</p>
                    <div className="cta-actions">
                        <button
                            type="button"
                            className="cta-button"
                            onClick={() => navigate("/register")}
                        >
                            Apply Now
                        </button>
                    </div>
                    <span className="cta-footnote">
                        Quick online registration • Verified tutors • Safe learning environment
                    </span>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="landing-footer">
                <div id="logo-container" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} role="button" tabIndex={0} aria-label="Scroll to top of YOSEF Tutorial Center">
                    <span className="footer-icon" aria-hidden="true">🎓</span>
                    <p>
                        YOSEF's Tutorial Center <span className="footer-muted">© {new Date().getFullYear()} All rights reserved.</span>
                    </p>
                </div>
                <div className="footer-links">
                    <button type="button" className="footer-link-btn" onClick={() => setActiveModal('terms')}>
                        Terms & Guidelines
                    </button>
                    <button type="button" className="footer-link-btn" onClick={() => setActiveModal('privacy')}>
                        Data Privacy Policy
                    </button>
                    <button type="button" className="footer-link-btn" onClick={() => setActiveModal('contact')}>
                        Contact Support
                    </button>
                </div>
            </footer>

            {/* ACCESSIBLE MODALS FOR FOOTER DISCLOSURES */}
            {activeModal && (
                <div
                    className="modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                    onClick={() => setActiveModal(null)}
                >
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 id="modal-title">
                                {activeModal === 'terms' && 'Terms & Tutorial Guidelines'}
                                {activeModal === 'privacy' && 'Data Privacy Policy'}
                                {activeModal === 'contact' && 'Contact & Center Inquiries'}
                            </h3>
                            <button
                                type="button"
                                className="modal-close-btn"
                                onClick={() => setActiveModal(null)}
                                aria-label="Close dialog"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            {activeModal === 'terms' && (
                                <>
                                    <p>Welcome to YOSEF Tutorial Center. By registering and using our tutorial services, you agree to the following guidelines:</p>
                                    <ul>
                                        <li><strong>Eligibility:</strong> Tutoring is available for elementary and middle school students in Grades 1 through 8.</li>
                                        <li><strong>Sessions:</strong> Sessions are conducted on a 1-on-1 basis under the chosen format (Face-to-Face, Online via Zoom, or Hybrid).</li>
                                        <li><strong>Attendance & Rescheduling:</strong> Session reschedule requests must be communicated at least 24 hours in advance through the portal calendar.</li>
                                        <li><strong>Conduct:</strong> A respectful and collaborative learning environment is maintained across all sessions and messaging channels.</li>
                                    </ul>
                                </>
                            )}
                            {activeModal === 'privacy' && (
                                <>
                                    <p>Your privacy and the security of student records are our utmost priority:</p>
                                    <ul>
                                        <li><strong>Data Collected:</strong> We collect student information (name, date of birth, grade level), parent/guardian contact details, and verification documents strictly for enrollment and tutoring administration.</li>
                                        <li><strong>Storage:</strong> Verification documents (Guardian ID, Certificate of Enrollment) are stored securely with encrypted access controls.</li>
                                        <li><strong>Third Parties:</strong> We never sell, lease, or share your personal information with external advertising or marketing entities.</li>
                                    </ul>
                                </>
                            )}
                            {activeModal === 'contact' && (
                                <>
                                    <p>Have questions or need assistance with your registration or account? Reach out to us:</p>
                                    <div className="contact-details-box">
                                        <div className="contact-item">
                                            <strong>📧 Email Support:</strong>
                                            <span>yoseftutorialcenter@gmail.com</span>
                                        </div>
                                        <div className="contact-item">
                                            <strong>📞 Mobile / Telephone:</strong>
                                            <span>+63 912 345 6789</span>
                                        </div>
                                        <div className="contact-item">
                                            <strong>📍 Tutorial Center Hours:</strong>
                                            <span>Monday – Saturday: 8:00 AM – 6:00 PM</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="modal-btn-confirm"
                                onClick={() => setActiveModal(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LandingPage;
