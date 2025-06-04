<!-- Needed to migrate users from sql server database to mysql database -->
// We generated a json object from the records in the sql server db and changed some column names to something that fit our own db netter--->
// We got the json object and made it look more like our db records with some scripts using the data in the existing object --->
// we wrote a script to hash passwords from the json object --->
// we we counted all branches and departments by looping through user objects --->
// we got a script to create the branches and departments on the db side from that --->
//  we wrote a function that creates users with the correct data on the server side --->
// we  wrote a script to then update each user permissions.

// Steps :
// Execute mysql query to create branches and departments --> copy user and auths json files --> run the utility functions for creating users and updating their authorizations on the server.
