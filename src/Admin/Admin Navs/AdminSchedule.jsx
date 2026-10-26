import FullCalendar from "@fullcalendar/react";

    import dayGridPlugin from "@fullcalendar/daygrid";
    import timeGridPlugin from "@fullcalendar/timegrid";
    import listPlugin from "@fullcalendar/list";
    import "./adminSchedule.css"
    import interactionPlugin from "@fullcalendar/interaction";
    import { supabase } from "../../lib/supabase";
    import { useEffect, useState } from "react";

    import { createNotification } from "../../Services/notificationService";


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

        // Filters (based on user)
        const [tutors, setTutors] = useState([]);
        const [students, setStudents] = useState([]);
        const [filterTutor, setFilterTutor] = useState("");
        const [filterStudent, setFilterStudent] = useState("");
        const [filterStatus, setFilterStatus] = useState("");

        useEffect(()=>{

        getEvents();
        loadFilterUsers();

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
        async function loadFilterUsers(){

            const { data, error } = await supabase
                .from("users")
                .select("id, Name, Role")
                .in("Role", ["Tutor", "Student"])
                .order("Name", { ascending: true });

            if (error) {
                console.error("Filter users error:", error);
                return;
            }

            setTutors((data || []).filter(u => u.Role === "Tutor"));
            setStudents((data || []).filter(u => u.Role === "Student"));

        }

        const filtersActive = filterTutor !== "" || filterStudent !== "" || filterStatus !== "";

        function clearFilters(){
            setFilterTutor("");
            setFilterStudent("");
            setFilterStatus("");
        }

        const filteredEvents = events.filter(event =>
            (filterTutor === "" || String(event.tutor_id) === filterTutor) &&
            (filterStudent === "" || String(event.student_id) === filterStudent) &&
            (filterStatus === "" || event.status === filterStatus)
        );

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
                    return;

                }

                ////                            ////
                ////    Student notification    ////
                ////                            ////

                await createNotification({
                    userId: info.event.extendedProps.student_id,

                    title: "Schedule Updated",

                    message:
                        `Your class schedule with ${info.event.title} has been moved to ${info.event.start.toLocaleString()}.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: info.event.id,

                    actionUrl: "/student/schedule"
                });


                ////                            ////
                ////    Tutor notification      ////
                ////                            ////

                await createNotification({
                    userId: info.event.extendedProps.tutor_id,

                    title: "Schedule Updated",

                    message:
                        `The class with ${info.event.title} has been moved to ${info.event.start.toLocaleString()}.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: info.event.id,

                    actionUrl: "/teacher/schedule"
                });

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
                    return;

                }

                // Student notification
                    await createNotification({
                        userId: info.event.extendedProps.student_id,

                        title: "Schedule Updated",

                        message:
                            `Your class schedule with ${info.event.title} has been updated. The session now ends at ${info.event.end.toLocaleString()}.`,

                        type: "schedule",

                        relatedTable: "calendar",

                        relatedId: info.event.id,

                        actionUrl: "/student/schedule"
                    });


                    // Tutor notification
                    await createNotification({
                        userId: info.event.extendedProps.tutor_id,

                        title: "Schedule Updated",

                        message:
                            `The class with ${info.event.title} has been updated. The session now ends at ${info.event.end.toLocaleString()}.`,

                        type: "schedule",

                        relatedTable: "calendar",

                        relatedId: info.event.id,

                        actionUrl: "/teacher/schedule"
                    });

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

                created_by: event.created_by,

                proof_url: event.proof_url,

                requested_start_datetime: event.requested_start_datetime,
                requested_end_datetime: event.requested_end_datetime,
                reschedule_reason: event.reschedule_reason,
                student_approval: event.student_approval,
                tutor_approval: event.tutor_approval,  
                admin_approval: event.admin_approval,
                reschedule_requested_by: event.reschedule_requested_by,

                backgroundColor:
                    event.status === "Pending"
                    ? "#ffc10741"
                    : event.status === "Confirmed"
                    ? "#4caf4f48"
                    : event.status === "Reschedule Pending"
                    ? "#9b27b03f"
                    : event.status === "Cancelled"
                    ? "#f4433638"
                    : event.status === "Attended"
                    ? "#2195f32d"
                    : event.status === "Absent"
                    ? "#61616131"
                    : "#607d8b34",

                    borderColor:
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

            
                    const { data: schedule, error } = await supabase
                    .from("calendar")
                    .insert({
                        title: selectedStudent.Name,
                        student_id: selectedStudent.id,
                        tutor_id: selectedStudent.details.Tutor_ID,
                        start_datetime: start.toISOString(),
                        end_datetime: end.toISOString(),
                        notes,
                        status: "Pending",
                        created_by:"Admin",
                        student_approval: "Approved",
                        tutor_approval: "Pending",
                        admin_approval: "Approved"
                    })
                    .select()
                    .single();

                    if(error){

                        console.log(error);

                        return;

                    }

                    alert("Schedule created.");


                    ////                    ///
                    //  Student Notification //
                    ////                    ///

                    await createNotification({
                        userId: selectedStudent.id,

                        title: "New Class Schedule",

                        message:
                            `An admin has scheduled a class for you on ${start.toLocaleString()}.`,

                        type: "schedule",

                        relatedTable: "calendar",

                        relatedId: schedule.id,

                        actionUrl: "/student/schedule"
                    });


                    
                    ////                    ///
                    //  Tutor Notification //
                    ////                    ///

                    await createNotification({
                        userId: selectedStudent.details.Tutor_ID,

                        title: "New Schedule Assigned",

                        message:
                            `An admin has scheduled a class with ${selectedStudent.Name} on ${start.toLocaleString()}.`,

                        type: "schedule",

                        relatedTable: "calendar",

                        relatedId: schedule.id,

                        actionUrl: "/teacher/schedule"
                    })

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
                


                ////                    ///
                //  Student Notification //
                ////                    ///
                await createNotification({
                    userId: selectedEvent.student_id,

                    title: "Schedule Approved",

                    message:
                        `Your class with ${selectedEvent.title} has been approved by the admin for ${new Date(
                            selectedEvent.start
                        ).toLocaleString()}.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: selectedEvent.id,

                    actionUrl: "/student/schedule"
                });



                ////                    ///
                //  Tutor Notification //
                ////                    ///

                await createNotification({
                    userId: selectedEvent.tutor_id,

                    title: "Schedule Approved",

                    message:
                        `The schedule with ${selectedEvent.title} has been approved by the admin for ${new Date(
                            selectedEvent.start
                        ).toLocaleString()}.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: selectedEvent.id,

                    actionUrl: "/teacher/schedule"
                });
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

                ////                            ////
                ////    Student notification    ////
                ////                            ////
                await createNotification({
                    userId: selectedEvent.student_id,

                    title: "Schedule Rejected",

                    message:
                        `The class schedule with ${selectedEvent.title} for ${new Date(
                            selectedEvent.start
                        ).toLocaleString()} was rejected by the admin.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: selectedEvent.id,

                    actionUrl: "/student/schedule"
                });


                ////                            ////
                ////    Tutor notification    ////
                ////                            ////

                await createNotification({
                    userId: selectedEvent.tutor_id,

                    title: "Schedule Rejected",

                    message:
                        `The schedule with ${selectedEvent.title} for ${new Date(
                            selectedEvent.start
                        ).toLocaleString()} was rejected by the admin.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: selectedEvent.id,

                    actionUrl: "/teacher/schedule"
                });

                await getEvents();

                setSelectedEvent(null);
        }

    async function approveReschedule(){

            if(selectedEvent.student_approval !== "Approved"){
                alert("Student has not approved this request.");
                return;
            }

            if(selectedEvent.tutor_approval !== "Approved"){
                alert("Tutor has not approved this request.");
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
                    tutor_approval: "Approved",
                    admin_approval: "Approved",

                    status: "Confirmed"

                })
                .eq("id", selectedEvent.id);

            if(error){
                console.log(error);
                return;
            }

                ////                            ////
                ////    Student notification    ////
                ////                            ////


                await createNotification({
                    userId: selectedEvent.student_id,

                    title: "Reschedule Approved",

                    message:
                        `The reschedule request has been approved. Your class is now scheduled for ${new Date(
                            selectedEvent.requested_start_datetime
                        ).toLocaleString()}.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: selectedEvent.id,

                    actionUrl: "/student/schedule"
                });


                ////                            ////
                ////    Student notification    ////
                ////                            ////

                await createNotification({
                    userId: selectedEvent.tutor_id,

                    title: "Reschedule Approved",

                    message:
                        `The reschedule request for your session with ${selectedEvent.title} has been approved for ${new Date(
                            selectedEvent.requested_start_datetime
                        ).toLocaleString()}.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: selectedEvent.id,

                    actionUrl: "/teacher/schedule"
                });

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

                    tutor_approval:
                        selectedEvent.tutor_approval,

                    admin_approval: "Rejected",

                    status: "Confirmed"

                })
                .eq("id", selectedEvent.id);

            if(error){

                console.log(error);

                return;

            }

            ////                            ////
            ////    Student notification    ////
            ////                            ////


            await createNotification({
                userId: selectedEvent.student_id,

                title: "Reschedule Rejected",

                message:
                    `The request to reschedule the class with ${selectedEvent.title} was rejected by the admin.`,

                type: "schedule",

                relatedTable: "calendar",

                relatedId: selectedEvent.id,

                actionUrl: "/student/schedule"
            });


            ////                            ////
            ////    Tutor notification      ////
            ////                            ////

            await createNotification({
                userId: selectedEvent.tutor_id,

                title: "Reschedule Rejected",

                message:
                    `The reschedule request for your session with ${selectedEvent.title} was rejected by the admin.`,

                type: "schedule",

                relatedTable: "calendar",

                relatedId: selectedEvent.id,

                actionUrl: "/teacher/schedule"
            });

            await getEvents();

            setSelectedEvent(null);

            alert("Reschedule rejected.");

        }

        return(<>
            <h1> ADMIN Schedule</h1>

            <div className="schedule-filters">

                <div className="schedule-filter-field">
                    <label>Tutor</label>
                    <select
                        value={filterTutor}
                        onChange={(e) => setFilterTutor(e.target.value)}
                    >
                        <option value="">All tutors</option>
                        {tutors.map(tutor => (
                            <option key={tutor.id} value={String(tutor.id)}>
                                {tutor.Name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="schedule-filter-field">
                    <label>Student</label>
                    <select
                        value={filterStudent}
                        onChange={(e) => setFilterStudent(e.target.value)}
                    >
                        <option value="">All students</option>
                        {students.map(student => (
                            <option key={student.id} value={String(student.id)}>
                                {student.Name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="schedule-filter-field">
                    <label>Status</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="">All statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Reschedule Pending">Reschedule Pending</option>
                        <option value="Attended">Attended</option>
                        <option value="Absent">Absent</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>
                </div>

                <div className="schedule-filter-summary">
                    <span>
                        Showing {filteredEvents.length} of {events.length} schedules
                    </span>
                    {filtersActive && (
                        <button onClick={clearFilters}>
                            Clear filters
                        </button>
                    )}
                </div>

            </div>

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

                /* ADD THIS HOOK HERE */
                eventDidMount={(info) => {
                    // 1. Remove standard borders
                    info.el.style.border = 'none';
                    
                    // 2. Set only the left border using the event's mapped borderColor
                    if (info.event.borderColor) {
                    info.el.style.borderLeft = `4px solid ${info.event.borderColor}`;
                    }
                }}

                 eventContent={(eventInfo) => {
                       const status = eventInfo.event.extendedProps.status;
                    return (
                        <div className="custom-event-content" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div className="fc-event-title" style={{ fontWeight: 'bold' , color:'#2563eb'}}>
                                {eventInfo.event.title}
                            </div>
                            <div className="fc-event-time" style={{ fontSize: '0.85em' , color:'#2563eb'}}>
                                {eventInfo.timeText}
                            </div>

                              <div
                                className={`fc-event-status ${
                                    status ? status.toLowerCase().replace(/\s+/g, "-") : ""
                                }`}

                                style={{ fontSize: '0.65em'}}
                            >
                                {status || "No Status"}
                            </div>
                        </div>
                    );
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
                events={filteredEvents}
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
                            {new Date(selectedEvent.start).toLocaleString()}
                        </p>

                        <p>
                            <strong>End:</strong>
                            {" "}
                            {new Date(selectedEvent.end).toLocaleString()}
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

                        <p>
                            <strong>Created By:</strong>
                            <br/>
                            {selectedEvent.created_by || "Unknown"}
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

                        {/* ===== Attendance proof uploaded by the tutor ===== */}
                        {selectedEvent.status === "Attended" && (

                            <div className="attendance-proof">

                                <strong>Attendance Proof:</strong>
                                <br/>

                                {selectedEvent.proof_url ? (

                                    <>
                                        <a
                                            href={selectedEvent.proof_url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <img
                                                src={selectedEvent.proof_url}
                                                alt="Attendance proof"
                                                style={{
                                                    maxWidth: "100%",
                                                    maxHeight: 240,
                                                    borderRadius: 8,
                                                    marginTop: 8,
                                                    cursor: "zoom-in"
                                                }}
                                            />
                                        </a>
                                        <br/>
                                        <small>Click the image to open it full size.</small>
                                    </>

                                ) : (

                                    <p>No proof uploaded.</p>

                                )}

                            </div>

                        )}

                        <br/><br/>
                        {(selectedEvent.status === "Pending" && selectedEvent.admin_approval !== "Approved") && (

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
                                    Tutor Approval:
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