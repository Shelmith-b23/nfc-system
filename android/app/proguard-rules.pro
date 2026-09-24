# Blessed Sacrament NFC Check-In Proguard Rules
-keepattributes *Annotation*
-dontwarn javax.annotation.**
-keepclassmembers class * {
    @androidx.room.* *;
}
