import FullCalendar from "@fullcalendar/react";

import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import "./adminSchedule.css"
import interactionPlugin from "@fullcalendar/interaction";
import { supabase } from "../../lib/supabase";
import { useEffect, useState } from "react";

function AdminSchedule(){
    const [events,setEvents]=useState([]);
    const [showModal, setShowModal] = useState(false);
    const [availableStudents, setAvailableStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [assignedTutor, setAssignedTutor] = useState(null);
    const [duration,setDuration] = useState(1);
    const [notes,setNotes]=useState("");
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [editMode, setEditMode] = useState(false);
    useEffect(()=>{

    getEvents();

    },[]);

    useEffect(() => {

        const channel = supabase
            .channel("admin-calendar-realtime")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "calendar",
                },
                async () => {

                    await getEvents();

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

                        } else {

                            setSelectedEvent(null);

                        }

                    }

                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, [selectedEvent]);

     let endDate = null;

    if(selectedDate){

        endDate = new Date(selectedDate);

        endDate.setHours(
            endDate.getHours()+duration
        );

    }
    async function loadTutor(tutorId){

        const { data } = await supabase
            .from("users")
            .select("*")
            .eq("id", tutorId)
            .single();

        setAssignedTutor(data);
    }

    async function loadAvailableStudents(startDate, hours = duration){

        const { data: students, error } = await supabase
        .from("users")
        .select(`
            *,
            details:user_details!users_detail_id_fkey(*)
        `)
        .eq("Role","Student")
        .eq("Status","Active");


        const endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + hours);

        const { data: schedules, error: scheduleError } = await supabase
            .from("calendar")
            .select("*")
            .lt("start_datetime", endDate.toISOString())
            .gt("end_datetime", startDate.toISOString());

        if (scheduleError) {
            console.error(scheduleError);
            return;
        }

        const busyStudents = (schedules || []).map(
            schedule => schedule.student_id
        );

        const busyTutors = (schedules || []).map(
            schedule => schedule.tutor_id
        );


        const available = students.filter(student =>
            !busyStudents.includes(student.id)
            &&
            !busyTutors.includes(student.details.Tutor_ID)
        );

        setAvailableStudents(available);
    }

    async function hasConflict(
            eventId,
            studentId,
            tutorId,
            start,
            end
        ){

            const { data, error } = await supabase
            .from("calendar")
            .select("*")
            .neq("id", eventId)
            .in("status", ["Pending","Confirmed"])
            .lt("start_datetime", end.toISOString())
            .gt("end_datetime", start.toISOString());

            if(error){
                console.log(error);
                return true;
            }

            const studentConflict = data.some(
                schedule => schedule.student_id === studentId
            );

            const tutorConflict = data.some(
                schedule => schedule.tutor_id === tutorId
            );

            return studentConflict || tutorConflict;

        }
   async function handleEventDrop(info){

            const confirmMove = window.confirm(
                "Move this schedule?"
            );

            if(!confirmMove){
                info.revert();
                return;
            }

            const conflict = await hasConflict(

                info.event.id,
                info.event.extendedProps.student_id,
                info.event.extendedProps.tutor_id,
                info.event.start,
                info.event.end

            );

            if(conflict){

                alert("Schedule conflict detected.");

                info.revert();

                return;

            }

            const { error } = await supabase

            .from("calendar")

            .update({

                start_datetime:info.event.start,
                end_datetime:info.event.end

            })

            .eq("id",info.event.id);

            if(error){

                console.log(error);

                info.revert();

            }

        }

    async function handleEventResize(info){

        const confirmResize = window.confirm(
                "Change session duration?"
            );

            if (!confirmResize) {
                info.revert();
                return;
            }

            const conflict = await hasConflict(

                info.event.id,
                info.event.extendedProps.student_id,
                info.event.extendedProps.tutor_id,
                info.event.start,
                info.event.end

            );

            if(conflict){

                alert("Schedule conflict detected.");

                info.revert();

                return;

            }

            const { error } = await supabase
            .from("calendar")
            .update({

                start_datetime:info.event.start,
                end_datetime:info.event.end

            })
            .eq("id",info.event.id);

            if(error){

                console.log(error);

                info.revert();

            }

        }
    async function getEvents(){

            const {data,error}=await supabase

            .from("calendar")

            .select("*");

            if(error){

            console.log(error);

            return;

            }

          const formatted = data.map(event => ({
            id: event.id,
            title: event.title,

            start: event.start_datetime,
            end: event.end_datetime,

            student_id: event.student_id,
            tutor_id: event.tutor_id,

            notes: event.notes,

            meeting_platform: event.meeting_platform,
            meeting_link: event.meeting_link,

            status: event.status,

            requested_start_datetime: event.requested_start_datetime,
            requested_end_datetime: event.requested_end_datetime,
            reschedule_reason: event.reschedule_reason,
            student_approval: event.student_approval,
            admin_approval: event.admin_approval,
            reschedule_requested_by: event.reschedule_requested_by,

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


    async function createSchedule(){

                if(!selectedStudent){
                    alert("Please select a student.");
                    return;
                }

                if(!selectedDate){
                    alert("Please select a date.");
                    return;
                }
                const start = new Date(selectedDate);

                const end = new Date(start);
                end.setHours(end.getHours() + duration);

                console.log("selectedDate", selectedDate);
                console.log("start", start);
                console.log("ISO", start.toISOString());

                const { error } = await supabase
                    .from("calendar")
                    .insert({
                        title: selectedStudent.Name,
                        student_id: selectedStudent.id,
                        tutor_id: selectedStudent.details.Tutor_ID,
                        start_datetime: start.toISOString(),
                        end_datetime: end.toISOString(),
                        notes,
                        status: "Confirmed",
                        color: "#4CAF50"
                    });

                if(error){

                    console.log(error);

                    return;

                }

                alert("Schedule created.");

                setShowModal(false);
                setSelectedStudent(null);
                setAssignedTutor(null);
                setDuration(1);
                setNotes("");
                setSelectedDate("");

                 await getEvents();

    }

    async function approveSession(){

            const { error } = await supabase
                .from("calendar")
                .update({
                    status: "Confirmed",
                    color: "#4CAF50"
                })
                .eq("id", selectedEvent.id);

            if(error){
                console.log(error);
                return;
            }

            await getEvents();

            setSelectedEvent(null);
    }


    async function rejectSession(){

            const confirmReject = window.confirm(
                "Reject this schedule request?"
            );

            if(!confirmReject) return;

            const { error } = await supabase
                .from("calendar")
                .update({
                    status: "Cancelled",
                    color: "#F44336"
                })
                .eq("id", selectedEvent.id);

            if(error){
                console.log(error);
                return;
            }

            await getEvents();

            setSelectedEvent(null);
    }

   async function approveReschedule(){

        if(selectedEvent.student_approval !== "Approved"){
            alert("Student has not approved this request.");
            return;
        }

        const conflict = await hasConflict(

            selectedEvent.id,
            selectedEvent.student_id,
            selectedEvent.tutor_id,
            new Date(selectedEvent.requested_start_datetime),
            new Date(selectedEvent.requested_end_datetime)

        );

        if(conflict){

            alert("Another schedule already occupies this time.");

            return;

        }

        const { data: student } = await supabase
            .from("users")
            .select("Status")
            .eq("id", selectedEvent.student_id)
            .single();

        if(student.Status !== "Active"){

            alert("This student's subscription is inactive.");

            return;

        }

        const { error } = await supabase
            .from("calendar")
            .update({

                start_datetime:
                    selectedEvent.requested_start_datetime,

                end_datetime:
                    selectedEvent.requested_end_datetime,

                requested_start_datetime: null,
                requested_end_datetime: null,
                reschedule_reason: null,

                student_approval: "Approved",
                admin_approval: "Approved",

                status: "Confirmed"

            })
            .eq("id", selectedEvent.id);

        if(error){
            console.log(error);
            return;
        }

        await getEvents();

        setSelectedEvent(null);

        alert("Reschedule approved.");

    }

    async function rejectReschedule(){

        const { error } = await supabase
            .from("calendar")
            .update({

                requested_start_datetime: null,
                requested_end_datetime: null,
                reschedule_reason: null,

                student_approval:
                    selectedEvent.student_approval,

                admin_approval: "Rejected",

                status: "Confirmed"

            })
            .eq("id", selectedEvent.id);

        if(error){

            console.log(error);

            return;

        }

        await getEvents();

        setSelectedEvent(null);

        alert("Reschedule rejected.");

    }

    return(<>
        <h1> ADMIN Schedule</h1>

        <div >
            <FullCalendar

            plugins={[

            dayGridPlugin,

            timeGridPlugin,

            interactionPlugin,

            listPlugin

            ]}

            initialView="timeGridWeek"
            
            headerToolbar={{

            left:"prev,next today",

            center:"title",

            right:"dayGridMonth,timeGridWeek,timeGridDay,listWeek"

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

            eventAllow={(dropInfo, draggedEvent)=>{

                return (
                    draggedEvent.extendedProps.status !== "Cancelled"
                    &&
                    draggedEvent.extendedProps.status !== "Absent"
                    &&
                    draggedEvent.extendedProps.status !== "Attended"
                );

            }}
            nowIndicator={true}
            events={events}
            editable={true}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}

          dateClick={async (info) => {
                console.log("Clicked!", info.date);

                  const date = new Date(info.date);

                // Format for datetime-local
                setSelectedDate(info.date);            
                await loadAvailableStudents(date);

      
                setSelectedStudent(null);
                setAssignedTutor(null);
                setNotes("");
                setDuration(1);
                setShowModal(true);
            }}
            />

            
        </div>


        {showModal && (

        <div className="modal-overlay">
              <div className="modal">
                    <select
                            value={selectedStudent?.id || ""}
                        onChange={async (e)=>{
                                const student = availableStudents.find(
                                    s => s.id == e.target.value
                                );

                                if (!student) {
                                    setSelectedStudent(null);
                                    setAssignedTutor(null);
                                    return;
                                }

                                setSelectedStudent(student);
                                await loadTutor(student.details.Tutor_ID);

                            }}
                        >
                            <option value="">
                                Select Student
                            </option>
                            {
                                availableStudents.map(student=>
                                <option
                                    key={student.id}
                                    value={student.id}
                                >
                                    {student.Name}
                                </option>
                            )
                            }
                        </select>
                        
                     {selectedStudent && (
                        <div>
                            <p>
                                Assigned Tutor:
                                <strong>{assignedTutor?.Name || "Loading..."}</strong>
                            </p>
                        </div>
                    )}
                        {selectedDate && (
                            <>
                            <label>Start Time</label>

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
                               onChange={async (e) => {

                                const newDate = new Date(e.target.value);

                                setSelectedDate(newDate);

                                await loadAvailableStudents(newDate);

                                setSelectedStudent(null);
                                setAssignedTutor(null);
                            }}
                            />
                            </>
                        )}

                        <select
                            value={duration}
                            onChange={async (e) => {
                                const hours = Number(e.target.value);

                                setDuration(hours);

                                if (selectedDate) {
                                    await loadAvailableStudents(selectedDate, hours);
                                }

                                setSelectedStudent(null);
                                setAssignedTutor(null);
                            }}
                        >

                        <option value={1}>1 Hour</option>

                        <option value={2}>2 Hours</option>

                        <option value={3}>3 Hours</option>

                        </select>

                    {endDate && (
                            <>
                            <label>End Time</label>

                            <input
                                    type="datetime-local"
                                    value={
                                        endDate
                                            ? new Date(
                                                endDate.getTime() -
                                                endDate.getTimezoneOffset() * 60000
                                            )
                                                .toISOString()
                                                .slice(0,16)
                                            : ""
                                    }
                                    readOnly
                                />
                            </>
                        )}

                        <textarea

                        placeholder="Notes"

                        value={notes}

                        onChange={(e)=>setNotes(e.target.value)}

                        />

                        <button
                            onClick={createSchedule}
                            disabled={!selectedStudent}
                        >
                            Schedule Session
                        </button>


                        <button
                        onClick={() => {
                            setShowModal(false);
                            setSelectedStudent(null);
                            setAssignedTutor(null);
                            setNotes("");
                            setDuration(1);
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
                        {" "}
                        {selectedEvent.meeting_platform || "N/A"}
                    </p>

                    <p>
                        <strong>Notes:</strong>
                        <br/>
                        {selectedEvent.notes || "No notes"}
                    </p>

                    {selectedEvent.meeting_link && (

                        <a
                            href={selectedEvent.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Open Meeting
                        </a>

                    )}

                    <br/><br/>
                    {selectedEvent.status === "Pending" && (

                        <>
                            <button onClick={approveSession}>
                                Approve
                            </button>

                            <button onClick={rejectSession}>
                                Reject
                            </button>
                        </>

                    )}

                    {selectedEvent.status === "Reschedule Pending" && (
                    <>

                        <button onClick={approveReschedule}>
                            Approve Reschedule
                        </button>

                        <button onClick={rejectReschedule}>
                            Reject Reschedule
                        </button>

                    </>
                    )}

                    {selectedEvent.status === "Reschedule Pending" && (

                        <div className="reschedule-status">

                            <h3>Reschedule Request</h3>

                            <p>
                                <strong>Requested By:</strong>
                                {" "}
                                {selectedEvent.reschedule_requested_by}
                            </p>

                            <p>
                                <strong>Requested Start:</strong>
                                <br />
                                {new Date(
                                    selectedEvent.requested_start_datetime
                                ).toLocaleString()}
                            </p>

                            <p>
                                <strong>Requested End:</strong>
                                <br />
                                {new Date(
                                    selectedEvent.requested_end_datetime
                                ).toLocaleString()}
                            </p>

                            <p>
                                <strong>Reason:</strong>
                                <br />
                                {selectedEvent.reschedule_reason}
                            </p>

                            <p>
                                Student Approval:
                                {" "}
                                {selectedEvent.student_approval}
                            </p>

                            <p>
                                Admin Approval:
                                {" "}
                                {selectedEvent.admin_approval}
                            </p>

                        </div>

                        )}

                    <button
                        onClick={()=>setSelectedEvent(null)}
                    >
                        Close
                    </button>

                </div>
            </div>

            )}
                </>);

  
}

export default AdminSchedule