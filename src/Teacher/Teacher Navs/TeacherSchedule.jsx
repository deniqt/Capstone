import './teacherSchedule.css'
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";

import { supabase } from "../../lib/supabase";
import { useEffect, useState } from "react";

function TeacherSchedule(){
    const [events, setEvents] = useState([]);
    const [loggedTutor, setLoggedTutor] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [duration, setDuration] = useState(1);
    const [notes, setNotes] = useState("");
    const [upcomingSessions, setUpcomingSessions] = useState([]);
    const [newScheduleRequest, setNewScheduleRequest] = useState([]);
    const [todayCount, setTodayCount] = useState(0);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [meetingPlatform, setMeetingPlatform] = useState("Zoom");
    const [meetingLink, setMeetingLink] = useState("");
    const [editMode, setEditMode] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [newScheduleDate, setNewScheduleDate] = useState(null);
    const [rescheduleDuration, setRescheduleDuration] = useState(1);
    const [rescheduleReason, setRescheduleReason] = useState("");


    useEffect(()=>{

        getTutor();

    },[]);

    useEffect(() => {
        if (!loggedTutor) return;
            getEvents(loggedTutor.id);
            loadStudents();
            loadUpcomingSessions();
            loadNewScheduleRequest();
            loadTodayCount();  
    }, [loggedTutor]);

   useEffect(() => {

            if (!loggedTutor) return;

            const channel = supabase
                .channel("calendar-realtime")
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "calendar",
                    },
                    async (payload) => {

                        console.log("Realtime:", payload);

                        await Promise.all([
                            getEvents(loggedTutor.id),
                            loadUpcomingSessions(),
                            loadNewScheduleRequest(),
                            loadTodayCount()
                        ]);

                        if (selectedEvent) {

                            const { data } = await supabase
                                .from("calendar")
                                .select("*")
                                .eq("id", selectedEvent.id)
                                .single();

                            if (data) {

                                setSelectedEvent({
                                    id: data.id,
                                    title: data.title,
                                    start: new Date(data.start_datetime),
                                    end: new Date(data.end_datetime),
                                    ...data
                                });

                            }

                        }

                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };

        }, [loggedTutor]);

    async function getTutor(){

        const {
            data:{user}
        } = await supabase.auth.getUser();

        const {data} = await supabase
        .from("users")
        .select("*")
        .eq("auth_id",user.id)
        .single();

        setLoggedTutor(data);

    }

    async function loadStudents(){

        const {data}=await supabase
        .from("users")
        .select(`
        *,
        details:user_details!users_detail_id_fkey(*)
        `)

        .eq("Role","Student")
        .eq("Status","Active")
        .eq("details.Tutor_ID",loggedTutor.id);
        setStudents(data);

    }

        
    async function getEvents(tutorId){

       const { data, error } = await supabase
        .from("calendar")
        .select("*")
        .eq("tutor_id", tutorId);
        if(error){

            console.log(error);

            return;

            }

           const formatted = data.map(event => ({
                id: event.id,
                title: event.title,
                start: event.start_datetime,
                end: event.end_datetime,
                status: event.status,
                notes: event.notes,
                student_id: event.student_id,
                tutor_id: event.tutor_id,
                requested_start_datetime: event.requested_start_datetime,
                requested_end_datetime: event.requested_end_datetime,
                reschedule_reason: event.reschedule_reason,
                student_approval: event.student_approval,
                tutor_approval: event.tutor_approval,  
                admin_approval: event.admin_approval,
                reschedule_requested_by: event.reschedule_requested_by,
                meeting_link: event.meeting_link,
                meeting_platform: event.meeting_platform,

                color:
                    event.status === "Pending"
                    ? "#FFC107"
                    : event.status === "Confirmed"
                    ? "#4CAF50"
                    : event.status === "Reschedule Pending"
                    ? "#9C27B0"
                    : event.status === "Cancelled"
                    ? "#F44336"
                    : event.status === "Attended"
                    ? "#2196F3"
                    : event.status === "Absent"
                    ? "#616161"
                    : "#607D8B"
            }));
            setEvents(formatted);

    }

    async function viewEvent(selectedID) {
        const{data, error} = await supabase
        .from("calendar")
        .select("*")
        .eq("id", selectedID)
        .single();


        if(error){
            console.log(error)
            return
        }

        console.log(data)
        const formatted = {
                id: data.id,
                title: data.title,
                start: data.start_datetime,
                end: data.end_datetime,
                status: data.status,
                notes: data.notes,
                student_id: data.student_id,
                tutor_id: data.tutor_id,
                requested_start_datetime: data.requested_start_datetime,
                requested_end_datetime: data.requested_end_datetime,
                reschedule_reason: data.reschedule_reason,
                student_approval: data.student_approval,
                tutor_approval: data.tutor_approval,  
                admin_approval: data.admin_approval,
                reschedule_requested_by: data.reschedule_requested_by,
                meeting_link: data.meeting_link,
                meeting_platform: data.meeting_platform,

                color:
                    data.status === "Pending"
                    ? "#FFC107"
                    : data.status === "Confirmed"
                    ? "#4CAF50"
                    : data.status === "Reschedule Pending"
                    ? "#9C27B0"
                    : data.status === "Cancelled"
                    ? "#F44336"
                    : data.status === "Attended"
                    ? "#2196F3"
                    : data.status === "Absent"
                    ? "#616161"
                    : "#607D8B"
            };
            
            console.log(formatted)

        setSelectedEvent(formatted);
       
    }
   
    async function createRequest(){
        const end = new Date(selectedDate);
        end.setHours(end.getHours() + duration);

       const { data: conflicts } = await supabase
        .from("calendar")
        .select("*")
        .eq("tutor_id", loggedTutor.id)
        .in("status", ["Pending", "Confirmed"])
        .lt("start_datetime", end.toISOString())
        .gt("end_datetime", selectedDate.toISOString());

        if (conflicts.length > 0) {
            alert("You already have another schedule during this time.");
            return;
        }

        if(
            meetingPlatform !== "Face To Face" &&
            meetingLink.trim()===""
        ){
            alert("Please provide the meeting link.");
            return;
        }

       const { error } = await supabase
        .from("calendar")
        .insert({
            title:selectedStudent.Name,
            student_id:selectedStudent.id,
            tutor_id:loggedTutor.id,
            start_datetime:selectedDate,
            end_datetime:end,
            notes,
            meeting_platform:meetingPlatform,
            meeting_link:meetingLink,
            status:"Pending",
            created_by:"Tutor",
            color:"#FFC107"
        });

        if(error){

        console.log(error);

        alert(error.message);

        return;

        }

        await Promise.all([
            getEvents(loggedTutor.id),
            loadUpcomingSessions(),
            loadTodayCount()
        ]);
        setShowModal(false);
        setSelectedStudent(null);
        setSelectedDate(null);
        setDuration(1);
        setNotes("");;
        setMeetingPlatform("Zoom");
        setMeetingLink(""); 

    }

    async function loadUpcomingSessions() {
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from("calendar")
            .select("*")
            .eq("tutor_id", loggedTutor.id)
            .eq("status", "Confirmed")
            .gte("start_datetime", now)
            .order("start_datetime")
            .limit(5);

        if (error) {
            console.log(error);
            return;
        }

        setUpcomingSessions(data);
    }
       
    async function loadNewScheduleRequest() {
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from("calendar")
            .select("*")
            .eq("tutor_id", loggedTutor.id)
            .eq("status", "Reschedule Pending")
            .eq("reschedule_requested_by", "Student")
            .order("start_datetime")
            .limit(5);

        if (error) {
            console.log(error);
            return;
        }

        setNewScheduleRequest(data);
    }

    async function loadTodayCount() {

        const today = new Date();

        const start = new Date(today);
        start.setHours(0,0,0,0);

        const end = new Date(today);
        end.setHours(23,59,59,999);

        const { count } = await supabase
            .from("calendar")
            .select("*", {
                count:"exact",
                head:true
            })
            .eq("tutor_id", loggedTutor.id)
            .gte("start_datetime", start.toISOString())
            .lte("start_datetime", end.toISOString());

        setTodayCount(count);
    }

    async function updateSession(){

        const { error } = await supabase
        .from("calendar")
        .update({
            notes:selectedEvent.notes,
            meeting_link:selectedEvent.meeting_link,
            meeting_platform:selectedEvent.meeting_platform
        })
        .eq("id", selectedEvent.id);

        if(error){
            console.log(error);
            return;
        }
        await getEvents(loggedTutor.id);
        await loadUpcomingSessions();
        setEditMode(false);

    }

    async function cancelSession(){

        const confirmCancel = window.confirm(
            "Cancel this session?"
        );

        if(!confirmCancel) return;
        await supabase
        .from("calendar")
        .update({
            status:"Cancelled"
        })
        .eq("id", selectedEvent.id);
        await Promise.all([
            getEvents(loggedTutor.id),
            loadUpcomingSessions(),
            loadTodayCount()
        ]);

        setSelectedEvent(null);
        

    }


    async function requestReschedule(){

        const end = new Date(newScheduleDate);

        end.setHours(
            end.getHours() + rescheduleDuration
        );

        const { data: conflicts } = await supabase
            .from("calendar")
            .select("*")
            .eq("tutor_id", loggedTutor.id)
            .in("status", [
                "Pending",
                "Confirmed",
                "Reschedule Pending"
            ])
            .neq("id", selectedEvent.id)
            .lt("start_datetime", end.toISOString())
            .gt("end_datetime", newScheduleDate.toISOString());

        if (conflicts && conflicts.length > 0){
            alert("Schedule conflict.");
            return;
        }

        const { error } = await supabase
            .from("calendar")
            .update({
                requested_start_datetime:
                    newScheduleDate.toISOString(),
                requested_end_datetime:
                    end.toISOString(),
                reschedule_reason:
                    rescheduleReason,
                reschedule_requested_by:
                    "Tutor",
                tutor_approval:
                    "Approved",
                student_approval:
                    "Pending",
                admin_approval:
                    "Pending",
                status:
                    "Reschedule Pending"

            })
            .eq("id", selectedEvent.id);
        if(error){
            console.log(error);
            return;
        }

        await getEvents(loggedTutor.id);
        await loadUpcomingSessions();
        setShowRescheduleModal(false);
        setNewScheduleDate(null);
        setRescheduleDuration(1);
        setRescheduleReason("");
        setSelectedEvent(null);
    }

    async function markAttended(){

        const { error } = await supabase
            .from("calendar")
            .update({
                status: "Attended"
            })
            .eq("id", selectedEvent.id);

        if(error){
            console.log(error);
            return;
        }

        await getEvents(loggedTutor.id);
        await loadUpcomingSessions();
        await loadTodayCount();

        setSelectedEvent(null);

    }

    async function markAbsent(){

        const confirmAbsent = window.confirm(
            "Mark this student as absent?"
        );

        if(!confirmAbsent) return;

        const { error } = await supabase
            .from("calendar")
            .update({
                status: "Absent"
            })
            .eq("id", selectedEvent.id);

        if(error){
            console.log(error);
            return;
        }

        await getEvents(loggedTutor.id);
        await loadUpcomingSessions();
        await loadTodayCount();
        setSelectedEvent(null);

    }

     async function approveReschedule(){


        if(selectedEvent.meeting_platform !== "Face To Face" &&
            !selectedEvent.meeting_link
        ){
            alert("provide Meeting Link")
            return;

        }
        if(selectedEvent.status === "Pending"){
            const { error } = await supabase
            .from("calendar")
            .update({

                tutor_approval:"Approved",
                status:"Confirmed"


            })
            .eq("id", selectedEvent.id);
        }

        const { error } = await supabase
        .from("calendar")
        .update({

            tutor_approval:"Approved"

        })
        .eq("id", selectedEvent.id);

        if(error){

            console.log(error);

            return;

        }
        alert("Schedule Approved")
        setSelectedEvent(null);
        await getEvents(loggedTutor.id);

        await loadTodaySessions(loggedTutor.id);

    }

    async function rejectReschedule(schedID){

        const confirmed = window.confirm("Are you sure you want to reject this reschedule?");

        if (!confirmed) return;


        const { error } = await supabase
        .from("calendar")
        .update({

            tutor_approval:"Rejected",

            requested_start_datetime:null,
            requested_end_datetime:null,
            reschedule_reason:null,

            status:"Confirmed"

        })
        .eq("id", schedID);

        if(error){

            console.log(error);

            return;

        }

        alert("Schedule Approved")
        setSelectedEvent(null);
        
        await getEvents(loggedTutor.id);

        await loadTodaySessions(loggedTutor.id);

      

    }
            
    return(<>
        <div className="TeacherScheduleHeader">
             <h1> TEACHER SCHEDULE</h1>
             <button
                className="Teacher-NewSession"
                onClick={()=>{
                setSelectedDate(new Date());
                setShowModal(true);
                }}
                >
                    + New Session
            </button>
        </div>

        <div className='TeacherScheduleLowerPanel'>
            <div className='TeacherScheduleLowerLeft'>
                <div className='TeacherScheduleCalendarPanel'>
                    <h3>Calendar</h3>
                        <div className='CalendarPanel'>
                            <FullCalendar
                                plugins={[
                                    dayGridPlugin,
                                    timeGridPlugin,
                                    interactionPlugin,
                                    listPlugin
                                ]}
                                    initialView="timeGridWeek"
                                    headerToolbar={{
                                        left:"dayGridMonth,timeGridWeek,timeGridDay,listWeek",
                                        right:"today prev,next"
                                    }}
                                    nowIndicator={true}
                                    events={events}
                                    dateClick={(info)=>{
                                        
                                    setSelectedDate(info.date);
                                    setShowModal(true);
                                }}

                                   eventClick={(info)=>{

                                        setSelectedEvent({
                                            id: info.event.id,
                                            title: info.event.title,
                                            start: info.event.start,
                                            end: info.event.end,
                                            ...info.event.extendedProps
                                        });

                                        

                                    }}
                                editable={false}
                               
                                height="100%"
                            />
                        </div>
                </div>
                <div className='TeacherScheduleUpcomingSessionPanel'>
                    <h3>Upcoming Sessions</h3>

                    {upcomingSessions.map(session => (

                        <div
                            key={session.id}
                            className="UpcomingCard"
                        >
                            <strong>{session.title}</strong>

                            <p>
                                {new Date(session.start_datetime)
                                    .toLocaleString()}
                            </p>

                            <p>{session.status}</p>
                            <p>

                            Platform:
                            {session.meeting_platform ?? "None"}

                            </p>

                        </div>

                    ))}
                </div>
            </div>
            <div className='TeacherScheduleLowerRight'>
                <div className='TeacherScheduleTodaySessionPanel'>
                    <h3>Today's Session</h3>
                        <br/>
                        <h1>{todayCount}</h1>
                </div>

                 <div className='TeacherScheduleSchedReqPanel'>
                    <h3>New Schedule Request</h3>
                    {newScheduleRequest.map(schedReq => (

                        <div
                            key={schedReq.id}
                            className="UpcomingCard"
                        >
                            <p>{schedReq.id}</p>
                            <strong>{schedReq.title}</strong>

                            <p>{schedReq.status}</p>
                            <button onClick={()=>(rejectReschedule(schedReq.id))}>Decline</button>
                            <button onClick={()=>(viewEvent(schedReq.id))}>View</button>
                
                        </div>

                    ))}
                </div>

                <div className='a'>
                    <h3>Tutor Ratings</h3>
                    <h3>(coming soon)</h3>
                </div>
            </div>

        </div>


        {showModal && (

            <div className="modal-overlay">
                <div className="modal">
                    <h2>New Schedule Request</h2>
                    <select
                        value={selectedStudent?.id || ""}
                        onChange={(e) => {
                            const student = students.find(
                                s => s.id == e.target.value
                            );

                            setSelectedStudent(student);
                        }}
                    >
                        <option value="">
                            Select Student
                        </option>

                        {students.map(student => (
                            <option
                                key={student.id}
                                value={student.id}
                            >
                                {student.Name}
                            </option>
                        ))}
                    </select>

                    <input
                         type="datetime-local"
                            value={
                                selectedDate
                                    ? new Date(
                                        selectedDate.getTime() -
                                        selectedDate.getTimezoneOffset() * 60000
                                    )
                                        .toISOString()
                                        .slice(0,16)
                                    : ""
                            }
                            onChange={(e)=>{
                                setSelectedDate(
                                    new Date(e.target.value)
                                );
                            }}
                    />

                   <select
                        value={duration}
                        onChange={(e)=>
                            setDuration(Number(e.target.value))
                        }
                    >
                        <option value={1}>1 Hour</option>
                        <option value={2}>2 Hours</option>
                        <option value={3}>3 Hours</option>
                    </select>

                    <textarea
                        placeholder="Reason / Notes"
                        value={notes}
                        onChange={(e)=>
                            setNotes(e.target.value)
                        }
                    />

                    <select
                        value={meetingPlatform}
                        onChange={(e)=>setMeetingPlatform(e.target.value)}
                    >
                        <option>Zoom</option>
                        <option>Google Meet</option>
                        <option>Face To Face</option>
                    </select>

                   {meetingPlatform !== "Face To Face" && (
                        <input
                            type="url"
                            placeholder="Meeting Link"
                            value={meetingLink}
                            onChange={(e)=>setMeetingLink(e.target.value)}
                        />
                    )}

                   <button
                        onClick={createRequest}
                        disabled={
                            !selectedStudent ||
                            !selectedDate
                        }
                    >
                        Submit Request
                    </button>

                    <button
                        onClick={()=>{
                            setShowModal(false);
                            setSelectedStudent(null);
                            setSelectedDate(null);
                            setDuration(1);
                            setNotes("");
                            setMeetingPlatform("Zoom");
                            setMeetingLink("");
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        )}





        {selectedEvent && (

        <div className="modal-overlay">

             <div className="modal">

                    <h2>{selectedEvent.title}</h2>

                        <p>
                            <strong>Status:</strong> {selectedEvent.status}
                        </p>

                        <p>
                            <strong>Start:</strong>
                            {" "}
                            {selectedEvent.start.toLocaleString()}
                        </p>

                        <p>
                            <strong>End:</strong>
                            {" "}
                            {selectedEvent.end.toLocaleString()}
                        </p>

                        <p>

                            <strong>Platform:</strong>

                            {selectedEvent.meeting_platform}

                        </p>



                    {editMode ? (

                        <textarea
                            value={selectedEvent.notes || ""}
                            onChange={(e)=>
                                setSelectedEvent({
                                    ...selectedEvent,
                                    notes:e.target.value
                                })
                            }
                        />

                    ) : (

                        <p>
                            <strong>Notes:</strong><br/>
                            {selectedEvent.notes || "No notes"}
                        </p>

                    )}



                    {selectedEvent.status === "Reschedule Pending" && (

                        <div className="reschedule-status">

                            <h3>Reschedule Request</h3>

                            <p>
                                <strong>Requested Date:</strong><br/>
                                {
                                    new Date(
                                        selectedEvent.requested_start_datetime
                                    ).toLocaleString()
                                }
                            </p>

                            <p>
                                <strong>Requested Start:</strong><br/>
                                {new Date(
                                    selectedEvent.requested_start_datetime
                                ).toLocaleString()}
                            </p>

                            <p>
                                <strong>Requested End:</strong><br/>
                                {new Date(
                                    selectedEvent.requested_end_datetime
                                ).toLocaleString()}
                            </p>

                            <p>
                                <strong>Reason:</strong><br/>
                                {selectedEvent.reschedule_reason}
                            </p>

                            <p>
                                Student Approval:
                                {" "}
                                {selectedEvent.student_approval}
                            </p>
                            
                                <p>
                                tutor Approval:
                                {" "}
                                {selectedEvent.tutor_approval}
                            </p>
                            

                            <p>
                                Admin Approval:
                                {" "}
                                {selectedEvent.admin_approval}
                            </p>

                        </div>
                    )}






                    {(selectedEvent.meeting_link || selectedEvent.status === "Pending")&& (
                        <>
                            {editMode ? (

                                <>
                                    <select
                                        value={selectedEvent.meeting_platform || ""}
                                        onChange={(e)=>
                                            setSelectedEvent({
                                                ...selectedEvent,
                                                meeting_platform:e.target.value
                                            })


                                        }
                                    >

                                        <option>Zoom</option>
                                        <option>Google Meet</option>
                                        <option>Face To Face</option>

                                    </select>

                                      {selectedEvent.meeting_platform !== "Face To Face" && (
                                            <input
                                                type="url"
                                                placeholder="Meeting Link"
                                                value={selectedEvent.meeting_link || ""}
                                                onChange={(e)=>
                                                    setSelectedEvent({
                                                        ...selectedEvent,
                                                        meeting_link:e.target.value
                                                    })
                                                }
                                            />
                                        )}      

                                </>

                               

                            ) : (

                                <> 

                                
                                    <p>
                                       <strong>Link: </strong> 
                                        {selectedEvent.meeting_link||"No link"}

                                    </p>
                                </>

                              

                            )}

                            {selectedEvent.meeting_platform !== "Face To Face" &&(
                                  <button
                                onClick={()=>
                                navigator.clipboard.writeText(
                                selectedEvent.meeting_link
                                )
                                }
                                >
                                Copy Link
                            </button>
                            )}

                          
                            {selectedEvent.status === "Confirmed" &&
                                selectedEvent.meeting_link &&(

                                    <a
                                        href={selectedEvent.meeting_link}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Join Meeting
                                    </a>
                                )
                            }

                            {selectedEvent.status === "Pending" &&

                                <p>
                                Waiting for approval.
                                </p>

                            }

                            
                        </>
                    )}







                {(selectedEvent.status === "Reschedule Pending" || selectedEvent.status === "Pending" ) &&
                        selectedEvent.tutor_approval === "Pending" && (

                            <>

                                <button
                                    onClick={approveReschedule}
                                >
                                    Approve
                                </button>

                                <button
                                    onClick={()=>{rejectReschedule(selectedEvent.id)}}
                                >
                                    Reject
                                </button>

                            </>

                )}





                {selectedEvent.status === "Confirmed" &&
                !selectedEvent.requested_start_datetime && (
                    <button
                        onClick={()=>{
                                setNewScheduleDate(selectedEvent.start);
                                const hours =
                                    (selectedEvent.end - selectedEvent.start) /
                                    (1000 * 60 * 60);

                                setRescheduleDuration(hours);
                                setRescheduleReason("");
                                setShowRescheduleModal(true);
                            
                             }
                        }
                    >
                        Reschedule
                    </button>
                    )
                }




                    {selectedEvent.status === "Confirmed" &&
                        new Date(selectedEvent.end) < new Date() && (

                            <>
                                <button onClick={markAttended}>
                                    Mark Attended
                                </button>

                                <button onClick={markAbsent}>
                                    Mark Absent
                                </button>
                            </>

                        )
                    }



                    {selectedEvent.status === "Pending" && (
                        !editMode?
                            (
                                <button onClick={() => setEditMode(true)}>
                                    Edit
                                </button>
                            )
                            :
                            (
                                <button onClick={updateSession}>
                                    Save
                                </button>
                            )

                        )
                    }



                    {selectedEvent.status==="Pending" && (

                            <button onClick={cancelSession}>
                                Cancel Session
                            </button>

                        )
                    }


                <button
                    onClick={()=>{
                    setSelectedEvent(null);
                    setEditMode(false);
                    }}
                    >
                    Close
                </button>

            </div>

        </div>

        )}


        {showRescheduleModal && (

            <div className="modal-overlay">
                <div className="modal">
                    <h2>Reschedule Session</h2>
                    <input
                        type="datetime-local"
                        value={
                            newScheduleDate
                            ?
                            new Date(
                                newScheduleDate.getTime()
                                -
                                newScheduleDate.getTimezoneOffset()*60000
                            )
                            .toISOString()
                            .slice(0,16)
                            :
                            ""
                        }
                        onChange={(e)=>
                            setNewScheduleDate(
                                new Date(e.target.value)
                            )
                        }
                    />
                    <select
                        value={rescheduleDuration}
                        onChange={(e)=>
                        setRescheduleDuration(
                        Number(e.target.value)
                        )
                        }
                    >
                        <option value={1}>1 Hour</option>
                        <option value={2}>2 Hours</option>
                        <option value={3}>3 Hours</option>
                    </select>

                    <textarea
                        placeholder="Reason"
                        value={rescheduleReason}
                        onChange={(e)=>
                        setRescheduleReason(
                        e.target.value
                            )
                        }
                    />

                    <button
                            onClick={requestReschedule}
                    >
                            Submit Request
                    </button>

                    <button
                            onClick={()=>{setShowRescheduleModal(false)}}
                    >
                        Cancel
                    </button>

                </div>
            </div>

        )}
                
    </>);
}

export default TeacherSchedule