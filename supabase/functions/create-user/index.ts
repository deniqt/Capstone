import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl =
    Deno.env.get("SUPABASE_URL")!;

const supabaseServiceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;


const supabaseAdmin =
    createClient(
        supabaseUrl,
        supabaseServiceRoleKey
    );


console.log(
    "create-user function started"
);


// ==========================================
// CORS
// ==========================================

const corsHeaders = {

    "Access-Control-Allow-Origin":
        "*",

    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",

    "Access-Control-Allow-Methods":
        "POST, OPTIONS"

};


// ==========================================
// SERVER
// ==========================================

Deno.serve(async (req) => {

    // ==========================================
    // CORS PREFLIGHT
    // ==========================================

    if (
        req.method === "OPTIONS"
    ) {

        return new Response(
            "ok",
            {
                status: 200,
                headers: corsHeaders
            }
        );

    }


    try {

        // ==========================================
        // ONLY POST
        // ==========================================

        if (
            req.method !== "POST"
        ) {

            return Response.json(
                {
                    error:
                        "Method not allowed."
                },
                {
                    status: 405,
                    headers:
                        corsHeaders
                }
            );

        }


        // ==========================================
        // READ REQUEST
        // ==========================================

        const body =
            await req.json();


        const {

            userType,

            fullName,

            dateOfBirth,

            school,

            phoneNumber,

            address,


            guardianName,

            guardianEmail,

            guardianRelationship,

            guardianPhone,


            email,

            password,


            tutorId,

            gradeLevel,

            profileUrl

        } = body;


        // ==========================================
        // VALID USER TYPE
        // ==========================================

        if (
            ![
                "Student",
                "Tutor",
                "Admin"
            ].includes(userType)
        ) {

            return Response.json(
                {
                    error:
                        "Invalid user type."
                },
                {
                    status: 400,
                    headers:
                        corsHeaders
                }
            );

        }


        // ==========================================
        // BASIC REQUIRED FIELDS
        // ==========================================

        if (
            !fullName?.trim() ||
            !dateOfBirth ||
            !email?.trim() ||
            !password
        ) {

            return Response.json(
                {
                    error:
                        "Full name, date of birth, email and password are required."
                },
                {
                    status: 400,
                    headers:
                        corsHeaders
                }
            );

        }


        // ==========================================
        // STUDENT VALIDATION
        // ==========================================

        if (
            userType === "Student"
        ) {

            if (
                !guardianName?.trim() ||
                !guardianEmail?.trim() ||
                !guardianRelationship?.trim() ||
                !guardianPhone?.trim() ||
                !gradeLevel?.trim()
            ) {

                return Response.json(
                    {
                        error:
                            "All required student information must be provided."
                    },
                    {
                        status: 400,
                        headers:
                            corsHeaders
                    }
                );

            }

        }


        // ==========================================
        // TUTOR / ADMIN PHONE
        // ==========================================

        if (
            (
                userType === "Tutor" ||
                userType === "Admin"
            ) &&
            !phoneNumber?.trim()
        ) {

            return Response.json(
                {
                    error:
                        "Phone number is required for tutors and administrators."
                },
                {
                    status: 400,
                    headers:
                        corsHeaders
                }
            );

        }


        // ==========================================
        // CREATE AUTH ACCOUNT
        // ==========================================

        const {

            data: authData,

            error: authError

        } =
            await supabaseAdmin
                .auth.admin
                .createUser({

                    email:
                        email.trim(),

                    password:
                        password,

                    email_confirm:
                        true

                });


        if (
            authError
        ) {

            console.error(
                "Auth creation error:",
                authError
            );


            return Response.json(
                {
                    error:
                        authError.message
                },
                {
                    status: 400,
                    headers:
                        corsHeaders
                }
            );

        }


        const authUser =
            authData.user;


        if (
            !authUser
        ) {

            throw new Error(
                "Supabase Auth account was not created."
            );

        }


        // ==========================================
        // CREATE PARENT RECORD
        // ==========================================

        let parentId =
            null;


        if (
            userType === "Student"
        ) {

            const {

                data: parentData,

                error: parentError

            } =
                await supabaseAdmin
                    .from(
                        "Parent_Table"
                    )
                    .insert({

                        Parent_Name:
                            guardianName.trim(),

                        Parent_Email:
                            guardianEmail.trim(),

                        Parent_Relation:
                            guardianRelationship.trim(),

                        Parent_Phone:
                            guardianPhone.trim()

                    })
                    .select(
                        "Parent_ID"
                    )
                    .single();


            if (
                parentError
            ) {

                console.error(
                    "Parent creation error:",
                    parentError
                );


                await supabaseAdmin
                    .auth.admin
                    .deleteUser(
                        authUser.id
                    );


                return Response.json(
                    {
                        error:
                            "Failed to create guardian information."
                    },
                    {
                        status: 500,
                        headers:
                            corsHeaders
                    }
                );

            }


            parentId =
                parentData.Parent_ID;

        }


        // ==========================================
        // CREATE USER DETAILS
        // ==========================================

        const {

            data: detailData,

            error: detailError

        } =
            await supabaseAdmin
                .from(
                    "user_details"
                )
                .insert({

                    profile_url:
                        profileUrl ||
                        null,

                    date_of_birth:
                        dateOfBirth,

                    Address:
                        address?.trim() ||
                        null,

                    school:
                        school?.trim() ||
                        null,

                    phone_number:
                        (
                            userType === "Tutor" ||
                            userType === "Admin"
                        )
                            ? phoneNumber?.trim() ||
                                null
                            : null,

                    Tutor_ID:
                        userType === "Student"
                            ? tutorId ||
                                null
                            : null,

                    Parent_ID:
                        parentId,

                    Grade_Level:
                        userType === "Student"
                            ? gradeLevel ||
                                null
                            : null

                })
                .select(
                    "detail_id"
                )
                .single();


        if (
            detailError
        ) {

            console.error(
                "User details creation error:",
                detailError
            );


            if (
                parentId
            ) {

                await supabaseAdmin
                    .from(
                        "Parent_Table"
                    )
                    .delete()
                    .eq(
                        "Parent_ID",
                        parentId
                    );

            }


            await supabaseAdmin
                .auth.admin
                .deleteUser(
                    authUser.id
                );


            return Response.json(
                {
                    error:
                        "Failed to create user details."
                },
                {
                    status: 500,
                    headers:
                        corsHeaders
                }
            );

        }


        // ==========================================
        // CREATE PUBLIC USER
        // ==========================================

        const {

            data: userData,

            error: userError

        } =
            await supabaseAdmin
                .from(
                    "users"
                )
                .insert({

                    Name:
                        fullName.trim(),

                    Role:
                        userType,

                    Email:
                        email.trim(),

                    auth_id:
                        authUser.id,

                    detail_id:
                        detailData.detail_id,

                    Status:
                        userType === "Student"
                            ? "Inactive"
                            : "Active"

                })
                .select(
                    "id"
                )
                .single();


        if (
            userError
        ) {

            console.error(
                "Public user creation error:",
                userError
            );


            await supabaseAdmin
                .from(
                    "user_details"
                )
                .delete()
                .eq(
                    "detail_id",
                    detailData.detail_id
                );


            if (
                parentId
            ) {

                await supabaseAdmin
                    .from(
                        "Parent_Table"
                    )
                    .delete()
                    .eq(
                        "Parent_ID",
                        parentId
                    );

            }


            await supabaseAdmin
                .auth.admin
                .deleteUser(
                    authUser.id
                );


            return Response.json(
                {
                    error:
                        "Failed to create user account."
                },
                {
                    status: 500,
                    headers:
                        corsHeaders
                }
            );

        }


        // ==========================================
        // SUCCESS
        // ==========================================

        return Response.json(
            {

                success:
                    true,

                message:
                    `${userType} account created successfully.`,

                userId:
                    userData.id,

                authId:
                    authUser.id

            },
            {
                status: 200,
                headers:
                    corsHeaders
            }
        );


    } catch (
        error
    ) {

        console.error(
            "Create user error:",
            error
        );


        return Response.json(
            {

                error:
                    error instanceof Error
                        ? error.message
                        : "Unexpected server error."

            },
            {
                status: 500,
                headers:
                    corsHeaders
            }
        );

    }

});