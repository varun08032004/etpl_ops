const fs = require('fs');
const path = require('path');

const files = [
  'TrainingProgrammes.js',
  'TrainingCourses.js',
  'TrainingAssessments.js',
  'TrainingAssignments.js',
  'TrainingCertificates.js',
  'TrainingCommandCenter.js',
  'TrainingEmployees.js',
  'TrainingMyTraining.js',
  'TrainingProgress.js',
  'TrainingReports.js',
  'TrainingAudit.js',
  'TrainingEmployees.js',
];

const iconMap = {
  'AddOutlinedIcon': 'Add',
  'EditOutlinedIcon': 'Edit',
  'DeleteOutlinedIcon': 'Delete',
  'VisibilityOutlinedIcon': 'Visibility',
  'SearchOutlinedIcon': 'Search',
  'ArchiveOutlinedIcon': 'Archive',
  'PersonAddOutlinedIcon': 'PersonAdd',
  'ArrowLeftOutlinedIcon': 'ArrowBack',
  'ArrowBackOutlinedIcon': 'ArrowBack',
  'FilterListOutlinedIcon': 'FilterList',
  'ContentCopyOutlinedIcon': 'ContentCopy',
  'SchoolOutlinedIcon': 'School',
  'MenuBookOutlinedIcon': 'MenuBook',
  'SettingsOutlinedIcon': 'Settings',
  'DownloadOutlinedIcon': 'Download',
  'QuizOutlinedIcon': 'Quiz',
  'VerifiedOutlinedIcon': 'Verified',
  'PlayCircleOutlinedIcon': 'PlayCircle',
  'CheckCircleOutlinedIcon': 'CheckCircle',
  'ScheduleOutlinedIcon': 'Schedule',
  'WarningOutlinedIcon': 'Warning',
  'VideoLibraryOutlinedIcon': 'VideoLibrary',
  'DescriptionOutlinedIcon': 'Description',
  'LinkOutlinedIcon': 'MuiLink',
  'BuildOutlinedIcon': 'Build',
  'RadioButtonCheckedOutlinedIcon': 'RadioButtonChecked',
  'ArrowForwardOutlinedIcon': 'ArrowForward',
  'PauseCircleOutlinedIcon': 'PauseCircle',
  'ArrowLeftOutlinedIcon': 'ArrowBack',
  'PersonAddOutlinedIcon': 'PersonAdd',
  'DragIndicatorOutlinedIcon': 'DragIndicator',
  'ExpandMoreOutlinedIcon': 'ExpandMore',
  'TrendingUpOutlinedIcon': 'TrendingUp',
  'AssignmentOutlinedIcon': 'Assignment',
  'PlayCircleOutlinedIcon': 'PlayCircle',
  'CheckCircleOutlinedIcon': 'CheckCircle',
  'ScheduleOutlinedIcon': 'Schedule',
  'WarningOutlinedIcon': 'Warning',
  'VideoLibraryOutlinedIcon': 'VideoLibrary',
  'DescriptionOutlinedIcon': 'Description',
  'PeopleOutlinedIcon': 'People',
  'TrendingUpOutlinedIcon': 'TrendingUp',
  'AssignmentOutlinedIcon': 'Assignment',
  'QuizOutlinedIcon': 'Quiz',
  'VerifiedOutlinedIcon': 'Verified',
  'ScheduleOutlinedIcon': 'Schedule',
  'WarningOutlinedIcon': 'Warning',
  'MenuBookOutlinedIcon': 'MenuBook',
  'VisibilityOutlinedIcon': 'Visibility',
  'EditOutlinedIcon': 'Edit',
  'DeleteOutlinedIcon': 'Delete',
  'SearchOutlinedIcon': 'Search',
  'ArchiveOutlinedIcon': 'Archive',
  'PersonAddOutlinedIcon': 'PersonAdd',
  'PersonOutlinedIcon': 'Person',
  'HistoryOutlinedIcon': 'History',
  'AssessmentOutlinedIcon': 'Assessment',
  'TrendingUpOutlinedIcon': 'TrendingUp',
  'PeopleOutlinedIcon': 'People',
  'ScheduleOutlinedIcon': 'Schedule',
  'WarningOutlinedIcon': 'Warning',
  'MenuBookOutlinedIcon': 'MenuBook',
  'VisibilityOutlinedIcon': 'Visibility',
  'EditOutlinedIcon': 'Edit',
  'DeleteOutlinedIcon': 'Delete',
  'SearchOutlinedIcon': 'Search',
  'ArchiveOutlinedIcon': 'Archive',
  'PersonAddOutlinedIcon': 'PersonAdd',
  'ArrowLeftOutlinedIcon': 'ArrowBack',
  'FilterListOutlinedIcon': 'FilterList',
  'ContentCopyOutlinedIcon': 'ContentCopy',
  'DragIndicatorOutlinedIcon': 'DragIndicator',
  'PlayCircleOutlinedIcon': 'PlayCircle',
  'CheckCircleOutlinedIcon': 'CheckCircle',
  'LinkOutlinedIcon': 'MuiLink',
  'BuildOutlinedIcon': 'Build',
  'RadioButtonCheckedOutlinedIcon': 'RadioButtonChecked',
  'ArrowForwardOutlinedIcon': 'ArrowForward',
  'PauseCircleOutlinedIcon': 'PauseCircle',
  'ArrowLeftOutlinedIcon': 'ArrowBack',
  'VideoLibraryOutlinedIcon': 'VideoLibrary',
  'DescriptionOutlinedIcon': 'Description',
  'ContentCopyOutlinedIcon': 'ContentCopy',
  'RadioButtonCheckedOutlinedIcon': 'RadioButtonChecked',
  'ArrowForwardOutlinedIcon': 'ArrowForward',
  'PauseCircleOutlinedIcon': 'PauseCircle',
  'ArrowBackOutlinedIcon': 'ArrowBack',
  'PeopleOutlinedIcon': 'People',
  'TrendingUpOutlinedIcon': 'TrendingUp',
  'AssignmentOutlinedIcon': 'Assignment',
  'QuizOutlinedIcon': 'Quiz',
  'VerifiedOutlinedIcon': 'Verified',
  'ScheduleOutlinedIcon': 'Schedule',
  'WarningOutlinedIcon': 'Warning',
  'MenuBookOutlinedIcon': 'MenuBook',
  'VisibilityOutlinedIcon': 'Visibility',
  'EditOutlinedIcon': 'Edit',
  'DeleteOutlinedIcon': 'Delete',
  'SearchOutlinedIcon': 'Search',
  'ArchiveOutlinedIcon': 'Archive',
  'PersonAddOutlinedIcon': 'PersonAdd',
  'PersonOutlinedIcon': 'Person',
  'HistoryOutlinedIcon': 'History',
  'AssessmentOutlinedIcon': 'Assessment',
  'ContentCopyOutlinedIcon': 'ContentCopy',
  'RadioButtonCheckedOutlinedIcon': 'RadioButtonChecked',
  'ArrowForwardOutlinedIcon': 'ArrowForward',
  'PauseCircleOutlinedIcon': 'PauseCircle',
  'ArrowBackOutlinedIcon': 'ArrowBack',
  'PlayCircleOutlinedIcon': 'PlayCircle',
  'CheckCircleOutlinedIcon': 'CheckCircle',
  'LinkOutlinedIcon': 'MuiLink',
  'BuildOutlinedIcon': 'Build',
  'RadioButtonCheckedOutlinedIcon': 'RadioButtonChecked',
  'ArrowForwardOutlinedIcon': 'ArrowForward',
  'PauseCircleOutlinedIcon': 'PauseCircle',
  'ArrowBackOutlinedIcon': 'ArrowBack',
  'CancelOutlinedIcon': 'Cancel',
};

const srcDir = path.join(__dirname, '..', 'src', 'pages');

files.forEach(file => {
  const filePath = path.join(srcDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Replace icon usages in JSX
  Object.entries(iconMap).forEach(([oldName, newName]) => {
    // Match <OldName ... /> or <OldName /> or <OldName prop="value" />
    const regex = new RegExp(`<${oldName}(\\s|/)`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `<${newName}$1`);
      modified = true;
    }
    // Match </OldName>
    const closeRegex = new RegExp(`</${oldName}>`, 'g');
    if (closeRegex.test(content)) {
      content = content.replace(closeRegex, `</${newName}>`);
      modified = true;
    }
    // Match <OldName ... >
    const openRegex = new RegExp(`<${oldName}(\\s[^>]*)>`, 'g');
    if (openRegex.test(content)) {
      content = content.replace(openRegex, `<${newName}$1>`);
      modified = true;
    }
  });
  
  // Special case for MuiLink (Link from MUI)
  content = content.replace(/<Link(\s|>)/g, '<MuiLink$1');
  content = content.replace(/<\/Link>/g, '</MuiLink>');
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${file}`);
  } else {
    console.log(`No changes needed: ${file}`);
  }
});

console.log('Done!');