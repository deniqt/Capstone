import { useNavigate } from 'react-router-dom';
import './landingPage.css'

function LandingPage(){

    const navigate = useNavigate();
    return(<>
        <div className="Landing-header">
            <button className='apply-button'
            onClick={()=>navigate("/register")}
            >Apply Now</button>
        </div>
    </>);
}
export default LandingPage;