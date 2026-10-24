import './teacherSchedule.css'
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import { createNotification } from "../../Services/notificationService";

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

    const [tutorRating, setTutorRating] = useState(0);
    const [ratingCount, setRatingCount] = useState(0);
    const [recentRatings, setRecentRatings] = useState([]);

    const [todayHours, setTodayHours] = useState(0);

    // ===== Attendance proof =====
    const [showAttendedModal, setShowAttendedModal] = useState(false);
    const [proofFile, setProofFile] = useState(null);
    const [proofPreview, setProofPreview] = useState(null);
    const [uploadingProof, setUploadingProof] = useState(false);

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
        loadTutorRatings();

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
         details:user_details!users_detail_id_fkey!inner(*)
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
                created_by:event.created_by,
                requested_start_datetime: event.requested_start_datetime,
                requested_end_datetime: event.requested_end_datetime,
                reschedule_reason: event.reschedule_reason,
                student_approval: event.student_approval,
                tutor_approval: event.tutor_approval,  
                admin_approval: event.admin_approval,
                reschedule_requested_by: event.reschedule_requested_by,
                meeting_link: event.meeting_link,
                meeting_platform: event.meeting_platform,
                proof_url: event.proof_url,

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
                created_by: data.created_by,
                requested_start_datetime: data.requested_start_datetime,
                requested_end_datetime: data.requested_end_datetime,
                reschedule_reason: data.reschedule_reason,
                student_approval: data.student_approval,
                tutor_approval: data.tutor_approval,  
                admin_approval: data.admin_approval,
                reschedule_requested_by: data.reschedule_requested_by,
                meeting_link: data.meeting_link,
                meeting_platform: data.meeting_platform,
                proof_url: data.proof_url,

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

       const { data:schedule, error } = await supabase
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
        }).select()
        .single();

        if(error){

        console.log(error);

        alert(error.message);

        return;

        }


        // ==========================================
        // NOTIFY STUDENT
        // ==========================================


        await createNotification({
            userId: selectedStudent.id,

            title: "New Class Schedule",

           message:
            `Your tutor has requested a class schedule for ${new Date(
                selectedDate
            ).toLocaleString()}.`,

            type: "schedule",
            relatedTable: "calendar",

            relatedId: schedule.id,

            actionUrl: "/student/schedule"
        });

        // ==========================================
        // NOTIFY ADMIN
        // ==========================================

        const {
            data: admins,
            error: adminError
        } = await supabase
            .from("users")
            .select("id, Name")
            .eq("Role", "Admin");

        if (adminError) {

            console.error(
                "Failed to load admins:",
                adminError
            );

        } else {

            for (const admin of admins || []) {

                await createNotification({

                    userId: admin.id,

                    title: "New Schedule Request",

                    message:
                        `${loggedTutor.Name} has requested a schedule with ${selectedStudent.Name}.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: schedule.id,

                    actionUrl: "/admin/schedule"

                });

            }

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
        start.setHours(0, 0, 0, 0);

        const end = new Date(today);
        end.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
            .from("calendar")
            .select("start_datetime, end_datetime")
            .eq("tutor_id", loggedTutor.id)
            .in("status", ["Confirmed", "Attended", "Absent"])
            .gte("start_datetime", start.toISOString())
            .lte("start_datetime", end.toISOString());

        if (error) {
            console.log(error);
            return;
        }

        setTodayCount(data?.length || 0);

        const hours = (data || []).reduce((total, session) => {

            const startTime = new Date(session.start_datetime);
            const endTime = new Date(session.end_datetime);

            const difference =
                (endTime - startTime) / (1000 * 60 * 60);

            return total + difference;

        }, 0);

        setTodayHours(hours);
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

        const { error } = await supabase
            .from("calendar")
            .update({
                status: "Cancelled"
            })
            .eq("id", selectedEvent.id);

        if(error){

            console.log(error);
            alert(error.message);

            return;
        }


        // ==========================================
        // NOTIFY STUDENT
        // ==========================================

        await createNotification({

            userId: selectedEvent.student_id,

            title: "Class Cancelled",

            message:
                `${loggedTutor.Name} has cancelled your class scheduled for ${new Date(
                    selectedEvent.start
                ).toLocaleString()}.`,

            type: "schedule",

            relatedTable: "calendar",

            relatedId: selectedEvent.id,

            actionUrl: "/student/schedule"

        });


        // ==========================================
        // NOTIFY ADMINS
        // ==========================================

        const {
            data: admins,
            error: adminError
        } = await supabase
            .from("users")
            .select("id, Name")
            .eq("Role", "Admin");


        if(adminError){

            console.error(
                "Failed to load admins:",
                adminError
            );

        } else {

            for(const admin of admins || []){

                await createNotification({

                    userId: admin.id,

                    title: "Schedule Cancelled",

                    message:
                        `${loggedTutor.Name} has cancelled the class with ${selectedEvent.title}.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: selectedEvent.id,

                    actionUrl: "/admin/schedule"

                });

            }

        }


        // ==========================================
        // REFRESH
        // ==========================================

        await Promise.all([

            getEvents(loggedTutor.id),

            loadUpcomingSessions(),

            loadTodayCount(),

            loadNewScheduleRequest()

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

        //              //
        // Student Notif//
        //              //
        await createNotification({
            userId: selectedEvent.student_id,

            title: "Reschedule Request",

            message:
                `${loggedTutor.Name} requested to reschedule your class to ${new Date(
                    newScheduleDate
                ).toLocaleString()}.`,

            type: "schedule",

            relatedTable: "calendar",

            relatedId: selectedEvent.id,

            actionUrl: "/student/schedule"
        });


        //              //
        // Admin Notif //
        //              //

        const {
            data: admins,
            error: adminError
        } = await supabase
            .from("users")
            .select("id, Name")
            .eq("Role", "Admin");

        if (adminError) {

            console.error(
                "Failed to load admins:",
                adminError
            );

        } else {

            for (const admin of admins || []) {

                await createNotification({

                    userId: admin.id,

                    title: "Tutor Reschedule Request",

                    message:
                        `${loggedTutor.Name} requested to reschedule a session with ${selectedEvent.title}.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: selectedEvent.id,

                    actionUrl: "/admin/schedule"

                });

            }

        }

        await getEvents(loggedTutor.id);
        await loadUpcomingSessions();
        setShowRescheduleModal(false);
        setNewScheduleDate(null);
        setRescheduleDuration(1);
        setRescheduleReason("");
        setSelectedEvent(null);
    }

    // ==========================================
    // ATTENDANCE PROOF
    // ==========================================

    function handleProofChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Please upload an image file.");
            e.target.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert("Image must be 5MB or smaller.");
            e.target.value = "";
            return;
        }

        if (proofPreview) URL.revokeObjectURL(proofPreview);

        setProofFile(file);
        setProofPreview(URL.createObjectURL(file));
    }

    function closeAttendedModal() {
        if (proofPreview) URL.revokeObjectURL(proofPreview);
        setShowAttendedModal(false);
        setProofFile(null);
        setProofPreview(null);
    }

    async function markAttended(){

        // 1. must be a past session
        if (new Date(selectedEvent.end) > new Date()) {
            alert("You can only mark a session as attended after it has ended.");
            return;
        }

        // 2. must have proof
        if (!proofFile) {
            alert("Please upload a picture as proof.");
            return;
        }

        setUploadingProof(true);

        // 3. upload image
        const ext = proofFile.name.split(".").pop();
        const filePath = `${selectedEvent.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from("attendance-proofs")
            .upload(filePath, proofFile, {
                cacheControl: "3600",
                upsert: false
            });

        if (uploadError) {
            console.log(uploadError);
            alert("Failed to upload proof: " + uploadError.message);
            setUploadingProof(false);
            return;
        }

        const { data: urlData } = supabase.storage
            .from("attendance-proofs")
            .getPublicUrl(filePath);

        // 4. update the session
        const { error } = await supabase
            .from("calendar")
            .update({
                status: "Attended",
                proof_url: urlData.publicUrl
            })
            .eq("id", selectedEvent.id)
            .eq("status", "Confirmed");

        if(error){

            console.log(error);
            alert(error.message);

            // remove the orphaned upload
            await supabase.storage
                .from("attendance-proofs")
                .remove([filePath]);

            setUploadingProof(false);
            return;

        }


        // ==========================================
        // NOTIFY STUDENT
        // ==========================================

        await createNotification({

            userId: selectedEvent.student_id,

            title: "Session Attended",

            message:
                `Your session with ${loggedTutor.Name} has been marked as attended.`,

            type: "schedule",

            relatedTable: "calendar",

            relatedId: selectedEvent.id,

            actionUrl: "/student/schedule"

        });


        await getEvents(loggedTutor.id);

        await loadUpcomingSessions();

        await loadTodayCount();

        setUploadingProof(false);

        closeAttendedModal();

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


        // ==========================================
        // NOTIFY STUDENT
        // ==========================================

        await createNotification({

            userId: selectedEvent.student_id,

            title: "Session Absent",

            message:
                `Your session with ${loggedTutor.Name} has been marked as absent.`,

            type: "schedule",

            relatedTable: "calendar",

            relatedId: selectedEvent.id,

            actionUrl: "/student/schedule"

        });


        await getEvents(loggedTutor.id);

        await loadUpcomingSessions();

        await loadTodayCount();

        setSelectedEvent(null);

    }

    async function approveReschedule() {

        if (
            selectedEvent.meeting_platform !== "Face To Face" &&
            !selectedEvent.meeting_link
        ) {
            alert("Provide Meeting Link");
            return;
        }

        const isNewSchedule = selectedEvent.status === "Pending";
        const isReschedule = selectedEvent.status === "Reschedule Pending";

        // ==========================================
        // APPROVE NEW SCHEDULE
        // ==========================================

        if (isNewSchedule) {

            const { error } = await supabase
                .from("calendar")
                .update({
                    tutor_approval: "Approved",
                    status: "Confirmed"
                })
                .eq("id", selectedEvent.id);

            if (error) {
                console.log(error);
                return;
            }

            // ==========================================
            // NOTIFY STUDENT
            // ==========================================

            await createNotification({
                userId: selectedEvent.student_id,

                title: "Schedule Approved",

                message:
                    `${loggedTutor.Name} approved your class schedule for ${new Date(
                        selectedEvent.start
                    ).toLocaleString()}.`,

                type: "schedule",

                relatedTable: "calendar",

                relatedId: selectedEvent.id,

                actionUrl: "/student/schedule"
            });

            // ==========================================
            // NOTIFY ADMINS
            // ==========================================

            const {
                data: admins,
                error: adminError
            } = await supabase
                .from("users")
                .select("id, Name")
                .eq("Role", "Admin");

            if (adminError) {

                console.error(
                    "Failed to load admins:",
                    adminError
                );

            } else {

                for (const admin of admins || []) {

                    await createNotification({

                        userId: admin.id,

                        title: "Schedule Approved",

                        message:
                            `${loggedTutor.Name} approved a schedule with ${selectedEvent.title}.`,

                        type: "schedule",

                        relatedTable: "calendar",

                        relatedId: selectedEvent.id,

                        actionUrl: "/admin/schedule"

                    });

                }

            }

        }

        // ==========================================
        // APPROVE RESCHEDULE
        // ==========================================

        else if (isReschedule) {

            const { error } = await supabase
                .from("calendar")
                .update({

                    tutor_approval: "Approved"

                })
                .eq("id", selectedEvent.id);

            if (error) {

                console.log(error);

                return;

            }

            // ==========================================
            // NOTIFY STUDENT
            // ==========================================

            await createNotification({

                userId: selectedEvent.student_id,

                title: "Reschedule Approved",

                message:
                    `${loggedTutor.Name} approved your request to reschedule the class to ${new Date(
                        selectedEvent.requested_start_datetime
                    ).toLocaleString()}.`,

                type: "schedule",

                relatedTable: "calendar",

                relatedId: selectedEvent.id,

                actionUrl: "/student/schedule"

            });

            // ==========================================
            // NOTIFY ADMINS
            // ==========================================

            const {
                data: admins,
                error: adminError
            } = await supabase
                .from("users")
                .select("id, Name")
                .eq("Role", "Admin");

            if (adminError) {

                console.error(
                    "Failed to load admins:",
                    adminError
                );

            } else {

                for (const admin of admins || []) {

                    await createNotification({

                        userId: admin.id,

                        title: "Reschedule Approved",

                        message:
                            `${loggedTutor.Name} approved the reschedule request for ${selectedEvent.title}.`,

                        type: "schedule",

                        relatedTable: "calendar",

                        relatedId: selectedEvent.id,

                        actionUrl: "/admin/schedule"

                    });

                }

            }

        }

        alert("Schedule Approved");

        setSelectedEvent(null);

        await Promise.all([
            getEvents(loggedTutor.id),
            loadUpcomingSessions(),
            loadTodayCount()
        ]);
    }

    async function rejectReschedule(schedID){

        const confirmed = window.confirm(
            "Are you sure you want to reject this reschedule?"
        );

        if (!confirmed) return;


        // Get the schedule first
        const {
            data: schedule,
            error: fetchError
        } = await supabase
            .from("calendar")
            .select("*")
            .eq("id", schedID)
            .single();


        if(fetchError){

            console.log(fetchError);

            return;

        }


        const { error } = await supabase
            .from("calendar")
            .update({

                tutor_approval: "Rejected",

                requested_start_datetime: null,
                requested_end_datetime: null,
                reschedule_reason: null,

                status: "Confirmed"

            })
            .eq("id", schedID);


        if(error){

            console.log(error);

            return;

        }


        // ==========================================
        // NOTIFY STUDENT
        // ==========================================

        await createNotification({

            userId: schedule.student_id,

            title: "Reschedule Request Rejected",

            message:
                `${loggedTutor.Name} has rejected your request to reschedule the class.`,

            type: "schedule",

            relatedTable: "calendar",

            relatedId: schedID,

            actionUrl: "/student/schedule"

        });


        // ==========================================
        // NOTIFY ADMINS
        // ==========================================

        const {
            data: admins,
            error: adminError
        } = await supabase
            .from("users")
            .select("id, Name")
            .eq("Role", "Admin");


        if(adminError){

            console.error(
                "Failed to load admins:",
                adminError
            );

        } else {

            for(const admin of admins || []){

                await createNotification({

                    userId: admin.id,

                    title: "Reschedule Rejected",

                    message:
                        `${loggedTutor.Name} rejected the reschedule request for ${schedule.title}.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: schedID,

                    actionUrl: "/admin/schedule"

                });

            }

        }


        alert("Schedule Rejected");


        setSelectedEvent(null);


        await Promise.all([

            getEvents(loggedTutor.id),

            loadTodayCount(),

            loadUpcomingSessions(),

            loadNewScheduleRequest()

        ]);

    }





   async function loadTutorRatings() {

        if (!loggedTutor) return;

        const { data, error } = await supabase
            .from("Session_Ratings")
            .select("*")
            .eq("Tutor_ID", loggedTutor.id)
            .order("created_at", {
                ascending: false
            });

        if (error) {

            console.log("Rating error:", error);

            return;

        }

        console.log("Tutor ratings:", data);

        if (!data || data.length === 0) {

            setTutorRating(0);
            setRatingCount(0);
            setRecentRatings([]);

            return;

        }

        const average =
            data.reduce(
                (total, item) =>
                    total + Number(item.Rating),
                0
            ) / data.length;

        setTutorRating(
            Number(average.toFixed(1))
        );

        setRatingCount(data.length);

        setRecentRatings(
            data.slice(0, 3)
        );
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

                                    eventContent={(eventInfo) => {
                                        return (
                                            <div className="custom-event-content" style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div className="fc-event-title" style={{ fontWeight: 'bold' , color:'#2563eb', fontSize:'9px'}}>
                                                    {eventInfo.event.title}
                                                </div>
                                                <div className="fc-event-time" style={{ fontSize: '0.85em' , color:'#2563eb',fontSize:'9px'}}>
                                                    {eventInfo.timeText}
                                                </div>
                                            </div>
                                        );
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
                                editable={false}
                               
                                height="100%"
                            />
                        </div>
                </div>
                <div className="TeacherScheduleUpcomingSessionPanel">

                    <div className="section-title">
                        <h3>Upcoming Sessions</h3>
                    </div>

                    {upcomingSessions.length === 0 ? (

                        <div className="empty-state">
                            No upcoming sessions.
                        </div>

                    ) : (

                        upcomingSessions.map(session => {

                            const start = new Date(session.start_datetime);
                            const end = new Date(session.end_datetime);

                            return (

                                <div
                                    key={session.id}
                                    className="UpcomingSessionCard"
                                >

                                    <div className="session-top">

                                        <div>
                                            <h4>
                                                {start.toLocaleTimeString([], {
                                                    hour: "numeric",
                                                    minute: "2-digit"
                                                })}
                                            </h4>

                                            <span>
                                                {end.toLocaleTimeString([], {
                                                    hour: "numeric",
                                                    minute: "2-digit"
                                                })}
                                            </span>
                                        </div>

                                        <span className="session-badge">
                                            Upcoming
                                        </span>

                                    </div>

                                    <h3>
                                        {session.title}
                                    </h3>

                                    <p className="session-student">
                                        👤 Tutor Session
                                    </p>

                                    <div className="session-platform">

                                        <span>
                                            {session.meeting_platform === "Face To Face"
                                                ? "📍 Face to Face"
                                                : "💻 Online Session"
                                            }
                                        </span>

                                    </div>

                                    <div className="session-actions">

                                        <button
                                            className="reschedule-btn"
                                            onClick={() => {

                                                setSelectedEvent({
                                                    id: session.id,
                                                    title: session.title,
                                                    start: start,
                                                    end: end,
                                                    ...session
                                                });

                                                setNewScheduleDate(start);

                                                const hours =
                                                    (end - start) /
                                                    (1000 * 60 * 60);

                                                setRescheduleDuration(hours);

                                                setRescheduleReason("");

                                                setShowRescheduleModal(true);

                                            }}
                                        >
                                            Reschedule
                                        </button>

                                        {session.meeting_link && (

                                            <a
                                                className="join-btn"
                                                href={session.meeting_link}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Join Meeting
                                            </a>

                                        )}

                                    </div>

                                </div>

                            );

                        })

                    )}

                </div>
            </div>
            <div className='TeacherScheduleLowerRight'>
                <div className="TeacherScheduleTodaySessionPanel">

                    <div className="today-stat-header">
                        <span>Today's Sessions</span>
                        <span>Total Hours</span>
                    </div>

                    <div className="today-stat-values">
                        <strong>{todayCount}</strong>

                        <strong>
                            {todayHours % 1 === 0
                                ? `${todayHours}h`
                                : `${todayHours.toFixed(1)}h`
                            }
                        </strong>
                    </div>

                </div>

                 <div className="TeacherScheduleSchedReqPanel">

                    <div className="section-header">
                        <h3>New Schedule Request</h3>

                        {newScheduleRequest.length > 0 && (
                            <span className="request-count">
                                {newScheduleRequest.length} New
                            </span>
                        )}
                    </div>

                    {newScheduleRequest.length === 0 ? (

                        <div className="empty-request">
                            No new requests
                        </div>

                    ) : (

                        newScheduleRequest.map(schedReq => (

                            <div
                                key={schedReq.id}
                                className="ScheduleRequestCard"
                            >

                                <div className="request-user">

                                    <div className="request-avatar">
                                        {schedReq.title?.charAt(0)}
                                    </div>

                                    <div>
                                        <strong>
                                            {schedReq.title}
                                        </strong>

                                        <p>
                                            Rescheduling request
                                        </p>
                                    </div>

                                </div>

                                <div className="request-actions">

                                    <button
                                        className="decline-btn"
                                        onClick={() =>
                                            rejectReschedule(schedReq.id)
                                        }
                                    >
                                        Decline
                                    </button>

                                    <button
                                        className="view-btn"
                                        onClick={() =>
                                            viewEvent(schedReq.id)
                                        }
                                    >
                                        View
                                    </button>

                                </div>

                            </div>

                        ))

                    )}

                </div>

                <div className="TeacherRatingsPanel">

                    <div className="section-header">

                        <h3>Past Tutor Ratings</h3>

                        {ratingCount > 0 && (
                            <span className="review-count">
                                {ratingCount} reviews
                            </span>
                        )}

                    </div>

                    <div className="rating-summary">

                        <div className="rating-number">
                            {tutorRating || "—"}
                        </div>

                        <div>

                            <div className="stars">

                                {[1, 2, 3, 4, 5].map(star => {

                                    const ratingValue = Number(tutorRating);

                                    if (star <= Math.floor(ratingValue)) {

                                        return (
                                            <span
                                                key={star}
                                                className="star filled"
                                            >
                                                ★
                                            </span>
                                        );

                                    }

                                    if (
                                        star === Math.floor(ratingValue) + 1 &&
                                        ratingValue % 1 !== 0
                                    ) {

                                        return (
                                            <span
                                                key={star}
                                                className="star half"
                                            >
                                                ★
                                            </span>
                                        );

                                    }

                                    return (
                                        <span
                                            key={star}
                                            className="star"
                                        >
                                            ★
                                        </span>
                                    );

                                })}

                            </div>

                            <p>
                                Average from students
                            </p>

                        </div>

                    </div>


                    <div className="rating-list">

                        {recentRatings.length === 0 ? (

                            <div className="empty-rating">
                                No ratings yet.
                            </div>

                        ) : (

                          recentRatings.map(rating => (

                                <div
                                    className="RatingCard"
                                    key={rating.Rating_ID}
                                >

                                    <div className="rating-user">

                                        <div className="rating-avatar">

                                            {rating.student?.Name
                                                ?.charAt(0)
                                                ?.toUpperCase() || "S"}

                                        </div>

                                        <div>

                                            <strong>
                                                {rating.student?.Name ||
                                                    "Student"}
                                            </strong>

                                            <div className="small-stars">

                                                {[1, 2, 3, 4, 5].map(star => (

                                                    <span
                                                        key={star}
                                                        className={
                                                            star <= Number(rating.Rating)
                                                                ? "star filled"
                                                                : "star"
                                                        }
                                                    >
                                                        ★
                                                    </span>

                                                ))}

                                            </div>

                                        </div>

                                       <strong className="rating-value">
                                            {Number(rating.Rating).toFixed(1)}
                                        </strong>
                                    </div>

                                    <p className="rating-comment">
                                        {rating.Comment ||
                                            "No comment provided."}
                                    </p>

                                </div>

                            ))

                        )}

                    </div>

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
                            {new Date(selectedEvent.start).toLocaleString()}
                        </p>

                        <p>
                            <strong>End:</strong>
                            {" "}
                            {new Date(selectedEvent.end).toLocaleString()}
                        </p>

                        <p>

                            <strong>Platform:</strong>

                            {selectedEvent.meeting_platform}

                        </p>

                        <p>

                            <strong>Created By: </strong>

                            { selectedEvent.created_by || "Unknown"}

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


                    {selectedEvent.status === "Attended" && selectedEvent.proof_url && (
                        <div>
                            <strong>Proof:</strong><br/>
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
                                        maxHeight: 200,
                                        borderRadius: 8
                                    }}
                                />
                            </a>
                        </div>
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
                                setNewScheduleDate(new Date(selectedEvent.start));
                                const hours =
                                    (new Date(selectedEvent.end) - new Date(selectedEvent.start)) /
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
                                <button onClick={() => setShowAttendedModal(true)}>
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



                    {(selectedEvent.status === "Pending" ||
                        selectedEvent.status === "Confirmed") && (

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


        {showAttendedModal && (

            <div className="modal-overlay">
                <div className="modal">
                    <h2>Mark as Attended</h2>

                    <p>
                        Upload a picture as proof that the session took place.
                    </p>

                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofChange}
                    />

                    {proofPreview && (
                        <img
                            src={proofPreview}
                            alt="Proof preview"
                            style={{
                                maxWidth: "100%",
                                maxHeight: 220,
                                borderRadius: 8,
                                marginTop: 10
                            }}
                        />
                    )}

                    <button
                        onClick={markAttended}
                        disabled={!proofFile || uploadingProof}
                    >
                        {uploadingProof ? "Uploading..." : "Confirm Attended"}
                    </button>

                    <button
                        onClick={closeAttendedModal}
                        disabled={uploadingProof}
                    >
                        Cancel
                    </button>

                </div>
            </div>

        )}
                
    </>);
}

export default TeacherSchedule