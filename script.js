// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut , onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";
import { getDatabase, ref as dbRef, set, get, update  } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { push } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

// Firebase Config (keep your existing config)
export const firebaseConfig = {}//cannot share key on github

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const database = getDatabase(app);

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// function sendOtpEmail(email, otp) {
//     // You can use EmailJS, SMTP.js, or Firebase Cloud Functions later
//     alert(`OTP sent to ${email}: ${otp}`);
//     console.log(`Simulated OTP for ${email}: ${otp}`);
// }
function sendOtp(email) {
    fetch("http://localhost:5000/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            alert("OTP sent to your email.");
        }
    });
}


// Register User
export function registerUser(email, password) {
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            // Save user data in Realtime Database
            set(dbRef(database, 'users/' + user.uid), {
                email: user.email,
                uid: user.uid,
                isVerified: false,
                createdAt: new Date().toISOString()
            })
               .then(() => {
                // Call Node API to generate OTP and send email
                fetch("http://localhost:5000/send-otp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: user.email,
                        uid: user.uid
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.message === "OTP sent successfully!") {
                        alert("Registration successful! An OTP has been sent to your email.");
                        window.location.href = "verify.html"; // Redirect to OTP verification page
                    } else {
                        alert("Failed to send OTP. Please try again.");
                    }
                })
                .catch((error) => {
                    console.error(error);
                    alert("An error occurred while sending OTP.");
                });
            })
            .catch((error) => {
                alert('Registered but failed to save user data: ' + error.message);
            });
        })
        .catch((error) => {
            alert(`Registration failed: ${error.message}`);
        });
}

// export function verifyOtp(email, enteredOtp) {
//     get(dbRef(database, 'users')).then((snapshot) => {
//         if (snapshot.exists()) {
//             const users = snapshot.val();
//             let userFound = false;

//             Object.keys(users).forEach((uid) => {
//                 const user = users[uid];
//                 if (user.email === email) {
//                     userFound = true;
//                     if (user.isVerified) {
//                         alert("User is already verified.");
//                         return;
//                     }

//                     if (Date.now() > user.otpExpiresAt) {
//                         alert("OTP has expired. Please register again.");
//                         return;
//                     }

//                     if (user.otp === enteredOtp) {
//                         update(dbRef(database, 'users/' + uid), {
//                             isVerified: true,
//                             otp: null,
//                             otpExpiresAt: null
//                         });
//                         alert("OTP verified successfully! You can now login.");
//                         window.location.href = "login.html";
//                     } else {
//                         alert("Invalid OTP.");
//                     }
//                 }
//             });

//             if (!userFound) {
//                 alert("No user found with this email.");
//             }
//         }
//     }).catch((error) => {
//         alert("Error verifying OTP: " + error.message);
//     });
// }
export function verifyOtp(email, enteredOtp) {
    // Call Node API (for SMTP) to verify OTP
    fetch("http://localhost:5000/verify-otp", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: email,
            otp: enteredOtp
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert("OTP verified successfully! You can now log in.");
            window.location.href = "login.html";
        } else {
            alert(data.error || "Failed to verify OTP.");
        }
    })
    .catch((error) => {
        console.error(error);
        alert("An error occurred during verification.");
    });
}

// Login User
export function loginUser(email, password) {
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            get(dbRef(database, 'users/' + user.uid)).then((snapshot) => {
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    if (userData.isVerified) {
                        window.location.href = "dashboard.html"; 
                    } else {
                        alert("Your email is not verified. Please check your inbox for the OTP.");
                        window.location.href = "verify.html"; 
                        signOut(auth);
                    }
                }
            });
        })
        .catch((error) => {
            alert(`Login failed: ${error.message}`);
        });
}

// Upload File to Realtime Database as Base64
export function uploadFile(file) {
    const user = auth.currentUser;
    if (!user) {
        alert("You must be logged in to upload files.");
        return Promise.reject("User not logged in"); 
    }

    return new Promise((resolve, reject) => { 
        const reader = new FileReader();

        reader.onload = function(event) {
            const base64String = event.target.result;

            // Save Base64 in DB under user
            const fileMetaRef = dbRef(database, 'users/' + user.uid + '/files');
            push(fileMetaRef, {
                name: file.name,
                uploadedAt: new Date().toISOString(),
                content: base64String
            })
            .then(() => {
                alert('File uploaded and saved to database!');
                resolve(); 
            })
            .catch((error) => {
                alert('Failed to save file: ' + error.message);
                reject(error); 
            });
        };

        reader.onerror = function(error) {
            alert('Failed to read file.');
            reject(error); 
        };

        reader.readAsDataURL(file); 
    });
}

