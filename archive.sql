/* Here are one after the other necessary queries to run after application startup */
Drop database earchive;
create database earchive;
INSERT INTO `archive_categories` (`id`, `name`, `description`, `created_by`, `createdAt`, `updatedAt`) VALUES
(3, 'IT', 'information and technology group', 'joel', '2024-08-28 16:06:21', '2024-08-28 16:06:21');


INSERT INTO `branches` (`id`, `slug`, `name`, `contact_person`, `address`, `email`, `phone_number`, `reg_number`, `created_by`, `createdAt`, `updatedAt`) VALUES
(4, 'asokwa-branch', 'Asokwa Branch', 'Acquah Osei Joel', 'CQ84 Algiers ST, AK-196-2248', 'oseijoel6111@gmail.com', '0206036178', 'R00002', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59');

INSERT INTO `branch_departments` (`id`, `branchId`,`departmentId`, `branchName`, `departmentName`,`departmentFolderPath`, `createdAt`, `updatedAt`) VALUES
(1, 4, 3, 'Asokwa Branch', 'IT', 'C:\\e-archiveUploads\\Asokwa Branch\\IT', NOW(), NOW() );

INSERT INTO `users` (
  `username`, `fullname`, `email`, `private_email`, `password`, `permissions`, `branchId`, `userGroupId`, `createdAt`, `updatedAt`
) VALUES (
  'microadmin', 'Aziz Yamin', 'admin@micro.com', 'admin@micro.com', 
  '$2a$10$wlSY/ztBTB3dpxUxMH8OCOV5JNxAPLU1HPjEbBYmTKPJUbiWM9kqi', 
  '[\"scanning\",\"archiving\",\"view-upload\",\"supervision-right\",\"email-notification\"]', 
  5, 3, NOW(), NOW()
);

/* The password here is probably 123 or 1234 */

INSERT INTO `authorizations` (
  `userId`, `scanning`, `archiving`, `view_upload`, `supervision_right`, `email_notification`, 
  `canViewOwnFiles`, `canViewDepartmentFiles`, `canViewBranchFiles`, `can_delete`
) VALUES (
  LAST_INSERT_ID(), TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE
);