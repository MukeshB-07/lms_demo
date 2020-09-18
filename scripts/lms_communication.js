var scorm = pipwerks.SCORM;
var lms_communication = this;
var queryStringCollection = {'isLms': 'false','debug':' ','lesson_location': ''};

var doesAPIResponded;
var waitCounter = 0;
var intervalID;

// Define exception/error codes
var _NoError = 0;
var _GeneralException = 101; 
var _InvalidArgumentError = 201;
var _NotInitialized = 301;
var _NotImplementedError = 401;

//LMS API
var isLms = false;
var API;
var _oLMSInitialized;

var startTime;
var endTime = new Date();
var cmiDataModel = {
    "1.2": {
        "bookmark": "cmi.core.lesson_location",
        "lessonStatus": "cmi.core.lesson_status",
        "rawScore": "cmi.core.score.raw",
        "minScore": "cmi.core.score.min",
        "maxScore": "cmi.core.score.max",
        "suspendData": "cmi.suspend_data",
        "totalTime": "cmi.core.session_time",
        "studentID": "cmi.core.student_id",
        "studentName": "cmi.core.student_name"
    },
    "2004": {
        "bookmark": "cmi.location",
        "lessonStatus": "cmi.completion_status",
        "successStatus": "cmi.success_status",
        "rawScore": "cmi.score.raw",
        "minScore": "cmi.score.min",
        "maxScore": "cmi.score.max",
        "scaledScore": "cmi.score.scaled",
        "scaledPassingScore": "cmi.scaled_passing_score",
        "suspendData": "cmi.suspend_data",
        "totalTime": "cmi.session_time",
        "studentID": "cmi.learner_id",
        "studentName": "cmi.learner_name",
        "interactions": ""
    }
}

var scormType = "1.2";
var firstTime_LMSSession = true;

try {
    API = getAPI();
    // Must call initialize
    _oLMSInitialized = scorm.init('');
    scormType = scorm.version;
    //console.log("lms_communication, scormType: ", scormType);

    //if(_oLMSInitialized)
    initValues();
} catch(e) {
    API = null;
    _oLMSInitialized = false;
}

function getAPI() {
    // start by looking for the API in the current window
    var theAPI = scorm.API.find(window);
    if ( (theAPI == null) && (window.opener != null) && (typeof(window.opener) != "undefined") ) {
        // try to find the API in the current window's opener
        theAPI = scorm.API.find(window.opener);
    }

    // Top frame.
    if (top.API) return top.API;

    // Parent frame.
    if (parent.API) return parent.API;

    // if the API has not been found
    if (theAPI == null) {
        // Alert the user that the API Adapter could not be found
        console.warn("Unable to find an API adapter - this is normal if viewing this course outside an LMS");
    }

    return theAPI;
}

function getTime() {
    var currentDate = new Date();
    var currentTime = currentDate.getHours() + ":" + currentDate.getMinutes() + ":" + currentDate.getSeconds();
    return currentTime;
}

// To Calculate Total Time Taken
function timeTaken() {
    var currentTimeDiff = getTimeDifference();
    var totalSec = currentTimeDiff;
    var tmp;

    var eMinutes = Math.floor(parseInt(totalSec) / 60);
    var eHours = Math.floor(parseInt(eMinutes) / 60);

    eMinutes = Math.floor(parseInt(eMinutes) % 60);
    tmp = parseInt(totalSec) % 60;

    if (parseInt(tmp) < 10) {tmp = "0" + tmp;}
    if (parseInt(eMinutes) < 10) {eMinutes = "0" + eMinutes;}
    if (parseInt(eHours) < 10) {eHours = "0" + eHours;}

    var totalTime = "";
    if(scormType == "1.2")
        totalTime = eHours + ":" + eMinutes + ":" + tmp;
    else
        totalTime = 'PT'+(eHours+'H')+''+(eMinutes+'M')+''+(tmp+'S');

    return totalTime;
}

// To Calculate Time Difference
function getTimeDifference() {
    var startSec = 0;
    var sArr = startTime.toString().split(":");

    startSec = startSec + parseInt(sArr[2]) + ((parseInt(sArr[1])) * 60) + ((parseInt(sArr[0])) * 60 * 60);

    var endSec = 0;
    var eArr = endTime.toString().split(":");
    endSec = endSec + parseInt(eArr[2]) + ((parseInt(eArr[1])) * 60) + ((parseInt(eArr[0])) * 60 * 60);

    var timeDiff = endSec - startSec;

    return timeDiff;
}
function sendInteraction(dataField, value) {
    console.log('sendInteraction, dataField: ',dataField,', value: ', value);
    try {
        var result = scorm.set(dataField, value);
    } catch (e) {
        //doesAPIResponded = false;
        console.error("Failed to record the value ", value, ", in field ", dataField);
    }
}
function setValues(bookmark, scoreFromCourse, passingScoreFromCourse, lessonStatus, suspendData) {
    console.log("setValues, bookmark: ", bookmark, ", scoreFromCourse: ", scoreFromCourse, ", lessonStatus: ", lessonStatus, ", suspendData: ", suspendData);
    doesAPIResponded = undefined;
    waitCounter = 0;
    clearInterval(intervalID);
    intervalID = setInterval(waitForResponse, 500);
    try {
        //console.log("oh yeah -- cmiDataModel[scormType].bookmark: ", cmiDataModel[scormType].bookmark);
        var bookmarkSaved = scorm.set(cmiDataModel[scormType].bookmark, bookmark);
        var lessonStatusSaved = scorm.set(cmiDataModel[scormType].lessonStatus, lessonStatus);

        scoreFromCourse = parseInt(scoreFromCourse, 10);
        var scoreSaved = true;
        if(!isNaN(scoreFromCourse) && scoreFromCourse >= 0) {
            console.log("checkpoint 1, isNaN(scoreFromCourse): ", isNaN(scoreFromCourse), ', scoreFromCourse: ', scoreFromCourse);
            var scoreFromLMS = parseInt(scorm.get(cmiDataModel[scormType].rawScore), 10);
            if(!isNaN(scoreFromLMS)){
                console.log("checkpoint 1.1, isNaN(scoreFromLMS): ", isNaN(scoreFromLMS), ', scoreFromLMS: ', scoreFromLMS);
                if(scoreFromCourse > scoreFromLMS){
                    scoreSaved = scorm.set(cmiDataModel[scormType].rawScore, scoreFromCourse);
                    if(scormType=="2004") {
                        scorm.set(cmiDataModel[scormType].scaledScore, (scoreFromCourse/100));
                        if (scoreFromCourse>=passingScoreFromCourse)
                            scorm.set(cmiDataModel[scormType].successStatus, 'passed');
                    }
                }
            } else {
                console.log("checkpoint 1.2, scormType: ", scormType);
                if(firstTime_LMSSession){
                    firstTime_LMSSession = false;
                    scorm.set(cmiDataModel[scormType].minScore, '0');
                    scorm.set(cmiDataModel[scormType].maxScore, '100');
                }
                scoreSaved = scorm.set(cmiDataModel[scormType].rawScore, scoreFromCourse);
                if(scormType=="2004") {
                    console.log("checkpoint 1.2.1, isNaN(passingScoreFromCourse): ", isNaN(passingScoreFromCourse), ', passingScoreFromCourse: ', passingScoreFromCourse);
                    scorm.set(cmiDataModel[scormType].scaledScore, (scoreFromCourse/100));
                    if(!isNaN(passingScoreFromCourse)) {
                        if (scoreFromCourse>=passingScoreFromCourse)
                            scorm.set(cmiDataModel[scormType].successStatus, 'passed');
                        else
                            scorm.set(cmiDataModel[scormType].successStatus, 'failed');
                    }
                }
            }
        } else {
            if(scormType=="2004") {
                // var scoreSaved = scorm.set(cmiDataModel[scormType].rawScore, 0);
                // scorm.set(cmiDataModel[scormType].scaledScore, 0);
                scorm.set(cmiDataModel[scormType].successStatus, 'failed');
            } 
            // else {
            //     var scoreSaved = true;
            // }
        }

        // if(scormType=="2004") {
        //     if(!isNaN(passingScoreFromCourse)) {
        //         var scaledPassingScoreSaved = scorm.set(cmiDataModel[scormType].scaledPassingScore, (passingScoreFromCourse/100));
        //     }
        // }

        var suspendDataSaved = scorm.set(cmiDataModel[scormType].suspendData, suspendData);

        endTime = getTime();
        var totalTime = timeTaken();

        var totalTimeSaved = scorm.set(cmiDataModel[scormType].totalTime, totalTime);

        errorHandler();

        var lmsDataSaved = scorm.save("");
    } catch (e) {
        doesAPIResponded = false;
        return false;
    }

    // if(bookmarkSaved == false || lessonStatusSaved == false || scoreSaved==false || suspendDataSaved == false || totalTimeSaved == false || lmsDataSaved == false) {
    if (bookmarkSaved == false || lessonStatusSaved == false || scoreSaved==false || suspendDataSaved == false || totalTimeSaved == false || lmsDataSaved == false) {
        doesAPIResponded = false;
    } else {
        doesAPIResponded = true;
        
    }
    return doesAPIResponded;
}

function waitForResponse() {
    console.log("waitForResponse, waitCounter: ", waitCounter, ", doesAPIResponded: ", doesAPIResponded);
    waitCounter++;
    if(waitCounter >= 10 || doesAPIResponded != undefined) {
        clearInterval(intervalID);
        if(doesAPIResponded==undefined)
            doesAPIResponded = false;

        if(doesAPIResponded==false){
            console.error("There is some error in LMS communication!");
            //confirm("Either popup blocker is on or internet connetion is lost. If you are running the course from LMS, your progress will not be recorded. Kindly, please turn off the popup blocker or check network cable and run the course again.");
        }
    }
}

function exitAu(){
    console.log("exitAu");
    endTime = getTime();
    var totalTime = timeTaken();
    scorm.set(cmiDataModel[scormType].totalTime, totalTime);
    errorHandler();
    scorm.save("");
    scorm.quit("");
    //alert("Function: exitAu(), Description: LMS Commit and LMS Finish executed");
}

function errorHandler() {
    // check for errors caused by or from the LMS
    var errCode = scorm.debug.getCode().toString();

    if (errCode != _NoError) {
        // an error was encountered so display the error description
        var errDescription = scorm.debug.getInfo(errCode);
        errDescription += "\n";
        errDescription += scorm.debug.getDiagnosticInfo(null);
        //alert("errorHandler errDescription:" + errDescription);
    }
}

function truncateSpaces(input) {
    var string_to_truncate = input;
    string_to_truncate = truncate_leading_spaces(string_to_truncate);
    string_to_truncate = truncate_trailing_spaces(string_to_truncate);
    return string_to_truncate;
}

//function to truncate Leading Spaces
function truncate_leading_spaces(thisString) {
    var name_with_spaces = thisString;
    var length_of_name = name_with_spaces.length;
    var j = 0;
    for (var i = 0; i < length_of_name; i++) {
        var get_character = name_with_spaces.charAt(i);
        if (get_character == " ") {
            j = j + 1;
            continue;
        } else {
            i = length_of_name;
        }
    }

    if(j > 0) {
        return name_with_spaces.substring(j, length_of_name);
    } else {
        return name_with_spaces;
    }
}

//function to truncate Trailing Spaces
function truncate_trailing_spaces(thisString) {
    var name_with_spaces = thisString;
    var length_of_name = name_with_spaces.length;
    var j = 0;
    for (var i = length_of_name; i > 0; i--) {
        var get_character = name_with_spaces.charAt(i - 1);
        if (get_character == " ") {
            j = j + 1;
            continue;
        } else {
            i = 0;
        }
    }

    if(j > 0) {
        return name_with_spaces.substring(0, length_of_name-j);
    } else {
        return name_with_spaces;
    }
}

function PageQuery(q) {
    if (q.length > 1) this.q = q.substring(1, q.length);
    else this.q = null;
    
    this.keyValuePairs = new Array();
    
    if(q) {
        for(var i=0; i < this.q.split("&").length; i++) {
            this.keyValuePairs[i] = this.q.split("&")[i];
        }
    }
    
    this.getValue = function(s) {
        for(var j=0; j < this.keyValuePairs.length; j++) {
            if(this.keyValuePairs[j].split("=")[0] == s)
                return this.keyValuePairs[j].split("=")[1];
        }
        return false;
    }
}

function initValues() {
    var debugType = " ";
    var qs = window.top.location.search.split('?')[1];

    if(qs && qs.length>0){
        qs = qs.split('=')[1];
    }

    if(qs && qs.length > 0)
        debugType = qs;

    queryStringCollection.debug = debugType;

    // console.log('initValues, API: ', API);
    if(API) {
        isLms = true;
        startTime = getTime();
        //Collect the common lms variables
        queryStringCollection = {
            'isLms': 'true',
            'scormType': scormType,
            'lesson_location': truncateSpaces(scorm.get(cmiDataModel[scormType].bookmark)),
            'lesson_status': truncateSpaces(scorm.get(cmiDataModel[scormType].lessonStatus)),
            'student_id': truncateSpaces(scorm.get(cmiDataModel[scormType].studentID)),
            'student_name': truncateSpaces(scorm.get(cmiDataModel[scormType].studentName)),
            'raw_score': truncateSpaces(scorm.get(cmiDataModel[scormType].rawScore)),
            'suspend_data': truncateSpaces(scorm.get(cmiDataModel[scormType].suspendData))
        }
        queryStringCollection.entry_type = (queryStringCollection.lesson_location=="" && queryStringCollection.lesson_location.length<=0)?"ab-initio":"resume";
        //console.log("initValues, queryStringCollection: ", queryStringCollection);
    }
}