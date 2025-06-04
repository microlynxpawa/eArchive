-- 📂 Archive Categories (Departments)
INSERT INTO `archive_categories` (`id`,`name`, `description`, `created_by`, `createdAt`, `updatedAt`) VALUES
(1,'Credit and marketing', 'Credit and marketing department', 'admin', '2024-08-28 16:06:21', '2024-08-28 16:06:21'),
(2,'Operations', 'Operations department', 'admin', '2024-08-28 16:06:21', '2024-08-28 16:06:21'),
(6,'IT', 'IT department', 'admin', '2024-08-28 16:06:21', '2024-08-28 16:06:21'),
(11,'Finance', 'Finance department', 'admin', '2024-08-28 16:06:21', '2024-08-28 16:06:21'),
(12,'Teller', 'Teller department', 'admin', '2024-08-28 16:06:21', '2024-08-28 16:06:21'),
(9,'Microfinance', 'Microfinance department', 'admin', '2024-08-28 16:06:21', '2024-08-28 16:06:21'),
(10,'HR', 'HR department', 'admin', '2024-08-28 16:06:21', '2024-08-28 16:06:21');


-- 🔁 Branches
-- In case email is still unique constrained
ALTER TABLE branches DROP INDEX email;

INSERT INTO `branches` (`id`,`slug`, `name`, `contact_person`, `address`, `email`, `phone_number`, `reg_number`, `created_by`, `createdAt`, `updatedAt`) VALUES
(1,'kuntanase', 'kuntanase', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(2,'atonsuagogo', 'atonsuagogo', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(6,'headoffice', 'headoffice', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(7,'edwinase', 'Edwinase', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(8,'global', 'global', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(9,'afiakobi', 'afiakobi', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(10,'kokofu', 'kokofu', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(11,'atonsubokro', 'atonsubokro', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(12,'bantama', 'Bantama', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(13,'magazine', 'magazine', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(14,'trede', 'trede', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(15,'abuakwa', 'abuakwa', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(16,'aputuogya', 'Aputuogya', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(17,'ahenemakokoben', 'ahenemakokoben', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(18,'jachie', 'jachie', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(19,'global-2', 'Global-2', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(20,'bmas', 'BMAS', 'admin', 'blank', 'admin@gmail.com', 'blank', 'blank', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59');
-- Nb i could update this by ckecking for branch ids from the user objects just like I mange to get the branches themselves via a query

