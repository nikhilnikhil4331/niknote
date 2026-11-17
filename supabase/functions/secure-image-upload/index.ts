 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
 import { readLimitedJson } from "../_shared/aiSecurity.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
   "Access-Control-Allow-Methods": "POST, OPTIONS",
 };
 
 // Rate limiting configuration
 const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
 const MAX_REQUESTS_PER_WINDOW = 10; // 10 image uploads per hour
 
 // Maximum decoded file size: 5 MB. The wire body is bounded separately for base64 overhead.
 const MAX_FILE_SIZE = 5 * 1024 * 1024;
 const MAX_REQUEST_BYTES = 7 * 1024 * 1024;
 const ALLOWED_BUCKET = "handwriting-samples";
 
 // Magic bytes for image validation
 const IMAGE_SIGNATURES: Record<string, { bytes: number[]; mimeType: string }> = {
   png: { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mimeType: "image/png" },
   jpg: { bytes: [0xFF, 0xD8, 0xFF], mimeType: "image/jpeg" },
   webp: { bytes: [0x52, 0x49, 0x46, 0x46], mimeType: "image/webp" }, // RIFF header
   gif: { bytes: [0x47, 0x49, 0x46, 0x38], mimeType: "image/gif" },
 };
 
 async function checkRateLimit(
   supabase: any,
   userId: string,
   endpoint: string
 ): Promise<{ allowed: boolean; remaining: number; resetAt: Date; unavailable?: boolean }> {
   const now = new Date();
   const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW * 1000);
   
   const { count, error } = await supabase
     .from('rate_limits')
     .select('*', { count: 'exact', head: true })
     .eq('user_id', userId)
     .eq('endpoint', endpoint)
     .gte('window_start', windowStart.toISOString());
 
   if (error) {
     console.error('Rate limit check error:', error);
     return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + RATE_LIMIT_WINDOW * 1000), unavailable: true };
   }
 
   const currentCount = count || 0;
   const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - currentCount - 1);
   const resetAt = new Date(now.getTime() + RATE_LIMIT_WINDOW * 1000);
   
   if (currentCount >= MAX_REQUESTS_PER_WINDOW) {
     return { allowed: false, remaining: 0, resetAt };
   }
 
   const { error: insertError } = await supabase.from('rate_limits').insert({
     user_id: userId,
     endpoint,
     window_start: now.toISOString(),
   });
   if (insertError) {
     console.error('Rate limit reservation error:', insertError);
     return { allowed: false, remaining: 0, resetAt, unavailable: true };
   }
 
   return { allowed: true, remaining, resetAt };
 }
 
 /**
  * Validate image magic bytes to ensure it's a real image
  */
 function validateImageMagicBytes(buffer: Uint8Array): { valid: boolean; format: string | null; mimeType: string | null } {
   for (const [format, signature] of Object.entries(IMAGE_SIGNATURES)) {
     const { bytes, mimeType } = signature;
     let matches = true;
     
     for (let i = 0; i < bytes.length; i++) {
       if (buffer[i] !== bytes[i]) {
         matches = false;
         break;
       }
     }
     
     if (matches) {
       // Additional check for WebP - must have "WEBP" at offset 8
       if (format === 'webp') {
         const webpMarker = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
         let webpValid = true;
         for (let i = 0; i < 4; i++) {
           if (buffer[8 + i] !== webpMarker[i]) {
             webpValid = false;
             break;
           }
         }
         if (!webpValid) continue;
       }
       
       return { valid: true, format, mimeType };
     }
   }
   
   return { valid: false, format: null, mimeType: null };
 }
 
 /**
  * Strip EXIF and metadata from image by decoding and re-encoding
  * This is a simplified version - for production, use a proper image processing library
  */
 function stripMetadataFromJpeg(buffer: Uint8Array): Uint8Array {
   // Find the start of scan marker (0xFFDA) - everything before it except APP markers is metadata
   // This is a simplified approach - we keep only essential segments
   
   const output: number[] = [];
   let i = 0;
   
   // Copy SOI marker
   if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
     output.push(0xFF, 0xD8);
     i = 2;
   } else {
     return buffer; // Not a valid JPEG
   }
   
   while (i < buffer.length - 1) {
     if (buffer[i] !== 0xFF) {
       i++;
       continue;
     }
     
     const marker = buffer[i + 1];
     
     // Skip APP markers (0xE0-0xEF) except APP0 (JFIF) which is needed
     if (marker >= 0xE1 && marker <= 0xEF) {
       // APP1-APP15 - skip these (contains EXIF, XMP, etc.)
       const segmentLength = (buffer[i + 2] << 8) | buffer[i + 3];
       i += 2 + segmentLength;
       continue;
     }
     
     // Skip comment marker (0xFE)
     if (marker === 0xFE) {
       const segmentLength = (buffer[i + 2] << 8) | buffer[i + 3];
       i += 2 + segmentLength;
       continue;
     }
     
     // For other markers, copy them
     if (marker === 0xD9) {
       // EOI - copy and done
       output.push(0xFF, 0xD9);
       break;
     } else if (marker === 0xD8 || marker === 0xD0 || marker === 0xD1 || 
                marker === 0xD2 || marker === 0xD3 || marker === 0xD4 ||
                marker === 0xD5 || marker === 0xD6 || marker === 0xD7) {
       // Standalone markers
       output.push(0xFF, marker);
       i += 2;
     } else if (marker === 0xDA) {
       // Start of scan - copy everything from here to the end
       while (i < buffer.length) {
         output.push(buffer[i]);
         i++;
       }
     } else if (marker >= 0xC0 && marker <= 0xCF || marker === 0xDB || 
                marker === 0xDD || marker === 0xE0) {
       // Copy these important segments (SOF, DQT, DRI, APP0)
       const segmentLength = (buffer[i + 2] << 8) | buffer[i + 3];
       for (let j = 0; j < segmentLength + 2; j++) {
         output.push(buffer[i + j]);
       }
       i += 2 + segmentLength;
     } else {
       // Unknown segment - copy it
       const segmentLength = (buffer[i + 2] << 8) | buffer[i + 3];
       for (let j = 0; j < segmentLength + 2; j++) {
         output.push(buffer[i + j]);
       }
       i += 2 + segmentLength;
     }
   }
   
   return new Uint8Array(output);
 }
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
   if (req.method !== "POST") {
     return new Response(JSON.stringify({ error: "Method not allowed" }), {
       status: 405,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 
   try {
     // Verify authentication
     const authHeader = req.headers.get("Authorization") || "";
     const token = /^Bearer\s+(\S+)$/i.exec(authHeader)?.[1] || "";
     if (!token) {
       return new Response(
         JSON.stringify({ error: "Unauthorized" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     
     const supabase = createClient(supabaseUrl, supabaseAnonKey, {
       global: { headers: { Authorization: authHeader } },
     });
 
     const { data: userData, error: userError } = await supabase.auth.getUser(token);
 
     if (userError || !userData?.user) {
       console.error("JWT verification failed:", userError);
       return new Response(
         JSON.stringify({ error: "Unauthorized" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const userId = userData.user.id;
     console.log(`Secure image upload request from user: ${userId}`);
 
     // Check rate limit using service role client
     const adminClient = createClient(supabaseUrl, supabaseServiceKey);
     const { allowed, remaining, resetAt, unavailable } = await checkRateLimit(adminClient, userId, 'secure-image-upload');
     if (unavailable) {
       return new Response(JSON.stringify({ error: "Upload rate limit is temporarily unavailable." }), {
         status: 503,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
     
     if (!allowed) {
       console.log(`Rate limit exceeded for user: ${userId}`);
       return new Response(
         JSON.stringify({ 
           error: "Rate limit exceeded. Image uploads are limited to prevent abuse. Please try again later.",
           retryAfter: Math.ceil((resetAt.getTime() - Date.now()) / 1000)
         }),
         { 
           status: 429, 
           headers: { 
             ...corsHeaders, 
             "Content-Type": "application/json",
             "X-RateLimit-Remaining": "0",
             "X-RateLimit-Reset": resetAt.toISOString(),
             "Retry-After": String(Math.ceil((resetAt.getTime() - Date.now()) / 1000))
           } 
         }
       );
     }
 
     const parsedBody = await readLimitedJson(req, MAX_REQUEST_BYTES);
     if (!parsedBody.ok) {
       return new Response(JSON.stringify({ error: parsedBody.reason === 'too_large' ? "Request body too large" : "Invalid JSON body" }), {
         status: parsedBody.reason === 'too_large' ? 413 : 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
     const bodyValue = parsedBody.value;
     if (!bodyValue || typeof bodyValue !== 'object' || Array.isArray(bodyValue)) {
       return new Response(JSON.stringify({ error: "Invalid upload request" }), {
         status: 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
     const body = bodyValue as Record<string, unknown>;
     const imageBase64 = body.imageBase64;
     const bucketValue = body.bucket ?? ALLOWED_BUCKET;
     if (bucketValue !== ALLOWED_BUCKET) {
       return new Response(JSON.stringify({ error: "Unsupported upload bucket" }), {
         status: 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
     const bucket = ALLOWED_BUCKET;
     if (typeof imageBase64 !== 'string' || !imageBase64) {
       return new Response(
         JSON.stringify({ error: "No image provided" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Extract base64 data (remove data URL prefix if present)
     let base64Data = imageBase64;
     if (imageBase64.startsWith('data:')) {
       const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
       if (!matches) {
         return new Response(
           JSON.stringify({ error: "Invalid image format" }),
           { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
       base64Data = matches[2];
       
       // Block SVG uploads
       if (matches[1].toLowerCase().includes('svg')) {
         return new Response(
           JSON.stringify({ error: "SVG uploads are not allowed for security reasons" }),
           { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
     }
 
     // Decode base64 to buffer
     let buffer: Uint8Array;
     try {
       const binaryString = atob(base64Data);
       buffer = new Uint8Array(binaryString.length);
       for (let i = 0; i < binaryString.length; i++) {
         buffer[i] = binaryString.charCodeAt(i);
       }
     } catch (e) {
       return new Response(
         JSON.stringify({ error: "Invalid base64 encoding" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Check file size
     if (buffer.length > MAX_FILE_SIZE) {
       return new Response(
         JSON.stringify({ error: `Image too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
         { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Validate magic bytes
     const validation = validateImageMagicBytes(buffer);
     if (!validation.valid) {
       console.error("Image magic bytes validation failed");
       return new Response(
         JSON.stringify({ error: "Invalid image file. Only PNG, JPEG, WebP, and GIF are allowed." }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log(`Valid ${validation.format} image detected, size: ${buffer.length} bytes`);
 
     // Strip EXIF metadata for JPEG images
     let processedBuffer = buffer;
     if (validation.format === 'jpg') {
       try {
         processedBuffer = stripMetadataFromJpeg(buffer);
         console.log(`Stripped EXIF metadata. Original: ${buffer.length}, After: ${processedBuffer.length}`);
       } catch (e) {
         console.error("Failed to strip EXIF, using original:", e);
         processedBuffer = buffer;
       }
     }
 
     // Generate safe filename
     const timestamp = Date.now();
     const randomId = crypto.randomUUID().split('-')[0];
     const extension = validation.format === 'jpg' ? 'jpeg' : validation.format;
     const safeFilename = `${userId}/${timestamp}-${randomId}.${extension}`;
 
     // Upload to storage
     const { data: uploadData, error: uploadError } = await adminClient.storage
       .from(bucket)
       .upload(safeFilename, processedBuffer, {
         contentType: validation.mimeType!,
         upsert: false,
       });
 
     if (uploadError) {
       console.error("Storage upload error:", uploadError);
       return new Response(
         JSON.stringify({ error: "Failed to upload image" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Get public URL
     const { data: urlData } = adminClient.storage
       .from(bucket)
       .getPublicUrl(safeFilename);
 
     console.log(`Image uploaded successfully: ${safeFilename}`);
 
     return new Response(
       JSON.stringify({
         success: true,
         path: safeFilename,
         url: urlData.publicUrl,
         format: validation.format,
         size: processedBuffer.length,
       }),
       { 
         headers: { 
           ...corsHeaders, 
           "Content-Type": "application/json",
           "X-RateLimit-Remaining": String(remaining),
           "X-RateLimit-Reset": resetAt.toISOString()
         } 
       }
     );
   } catch (error) {
     console.error("Error in secure-image-upload function:", error);
     return new Response(
       JSON.stringify({ error: "Failed to process image upload" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });