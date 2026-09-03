import { useNavigate } from 'react-router-dom';
import './landingPage.css'
import logoImage from '../assets/logo.png'
import heroImage from '../assets/landing.png'

function LandingPage(){

    const navigate = useNavigate();

    return(<>
        <div className="Landing-header">
            <div id='logo-container'  onClick={()=>navigate("/")}>
                <img id='landing-logo' src={logoImage || "tite"}></img>
                <p>YOSEF's Tutorial Center</p>
            </div>
            <button className='apply-button'
             onClick={()=>navigate("/register")}
            >Apply Now</button>
        </div>

        <section className="hero-section">
            <div className="hero-copy">
                <span className="hero-eyebrow">Built for future students in grades 1–8</span>
                <h1 className="hero-title">
                    Start learning with confidence, curiosity, and support.
                </h1>
                <p className="hero-description">
                    YOSEF LearnHub helps future students in grades 1–8 discover engaging
                    lessons, caring tutors, and a simple path to stronger skills in math,
                    reading, science, and more.
                </p>

                <div className="hero-tags">
                    <span className="hero-tag">Easy-to-follow lessons</span>
                    <span className="hero-tag">Friendly tutors</span>
                    <span className="hero-tag">Safe learning environment</span>
                </div>

                <div className="hero-actions">
                    <button className="apply-button" onClick={()=>navigate("/register")}>
                        Apply Now
                    </button>
                
                </div>
            </div>

            <div className="hero-media">
                <img id="hero-image" src={heroImage} alt="A tutor and student learning together" />

                <div className="hero-stats">
                    <div className="hero-stat">
                        <h3>1–8</h3>
                        <p>Grades supported from early basics to middle school growth</p>
                    </div>
                    <div className="hero-stat">
                        <h3>Live</h3>
                        <p>Small-group and one-on-one sessions with real tutors</p>
                    </div>
                    <div className="hero-stat">
                        <h3>Fun</h3>
                        <p>Clear milestones, encouragement, and engaging activities</p>
                    </div>
                </div>
            </div>
        </section>

        <section className="why-section">
            <span className="section-eyebrow">Why students choose YOSEF</span>
            <h2 className="section-title">A learning portal made for growing minds</h2>
            <p className="section-subtitle">
                From first reading goals to stronger problem-solving skills, students get a
                welcoming experience that feels clear, motivating, and easy to begin.
            </p>

            <div className="why-grid">
                <div className="why-card">
                    <div className="why-icon">🙂</div>
                    <h3>Friendly Learning</h3>
                    <p>Lessons are designed to feel welcoming, simple, and encouraging so
                    younger learners can stay focused and enjoy making progress.</p>
                </div>
                <div className="why-card">
                    <div className="why-icon">🧑‍🤝‍🧑</div>
                    <h3>Great Tutors</h3>
                    <p>Students meet patient tutors who explain clearly, celebrate wins,
                    and adapt lessons for different ages and confidence levels.</p>
                </div>
                <div className="why-card">
                    <div className="why-icon">🎯</div>
                    <h3>Step-by-Step Progress</h3>
                    <p>Short goals and visible milestones help students understand what
                    they are learning and feel proud of every new skill.</p>
                </div>
                <div className="why-card">
                    <div className="why-icon">💻</div>
                    <h3>Learn Anywhere</h3>
                    <p>Join from home on a simple online platform with easy access to
                    lessons, schedules, and helpful learning resources.</p>
                </div>
            </div>
        </section>

        <section className="how-section">
            <h2 className="section-title">How it works for future students</h2>
            <p className="section-subtitle">
                Getting started is easy, supportive, and designed to help grades 1–8
                students feel ready from day one.
            </p>

            <div className="how-grid">
                <div className="how-step">
                    <span className="how-number">1</span>
                    <h3>Apply Now</h3>
                    <p>Share a few details about the student, grade level, and learning
                    goals so the right tutoring path can be recommended.</p>
                </div>
                <div className="how-step">
                    <span className="how-number">2</span>
                    <h3>Meet Your Tutor</h3>
                    <p>Get matched with a supportive tutor who understands the student's
                    level, pace, and areas where confidence needs to grow.</p>
                </div>
                <div className="how-step">
                    <span className="how-number">3</span>
                    <h3>Start Learning</h3>
                    <p>Attend live lessons, build strong habits, and track progress
                    through clear updates that keep students motivated.</p>
                </div>
            </div>
        </section>

        <section className="info-section">
            <div className="info-card">
                <span className="info-eyebrow">Designed for grades 1–8</span>
                <h3>Support for every stage of early learning</h3>
                <p>Whether a student is building reading fluency, practicing
                multiplication, or preparing for the next school year, the portal
                keeps learning structured and age-appropriate.</p>
                <ul className="info-list">
                    <li>Clear lesson plans and simple next steps</li>
                    <li>Learning goals tailored to student level</li>
                    <li>Encouraging feedback after each session</li>
                </ul>
            </div>
            <div className="info-card">
                <span className="info-eyebrow">Why families feel confident</span>
                <h3>A simple, welcoming portal that removes the stress</h3>
                <p>Students can focus on learning while families stay informed with
                schedules, tutor updates, and a clear view of progress.</p>
                <ul className="info-list">
                    <li>Easy access to class times and reminders</li>
                    <li>Visible progress that feels rewarding</li>
                    <li>Safe online sessions with trusted educators</li>
                </ul>
            </div>
        </section>

        <section className="cta-section">
            <div className="cta-box">
                <h2>Ready to help your future student get started?</h2>
                <p>Apply now and discover a friendly learning experience that helps
                grades 1–8 students build skills, confidence, and momentum.</p>
                <button className="cta-button" onClick={()=>navigate("/register")}>
                    Apply Now
                </button>
                <span className="cta-footnote">
                    Simple application. Supportive onboarding. Learning that feels
                    exciting from the start.
                </span>
            </div>
        </section>

        <footer className="landing-footer">
            <div id='logo-container'>
                <span className="footer-icon">🎓</span>
                <p>YOSEF LearnHub <span className="footer-muted">© 2025 All rights reserved.</span></p>
            </div>
            <div className="footer-links">
                <a href="/terms">Terms of Service</a>
                <a href="/privacy">Privacy Policy</a>
                <a href="/contact">Contact Support</a>
            </div>
        </footer>

    </>);
}
export default LandingPage;