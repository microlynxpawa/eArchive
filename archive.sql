-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 05, 2024 at 01:02 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `h`
--

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

INSERT INTO `archive_categories` (`id`, `name`, `description`, `created_by`, `createdAt`, `updatedAt`) VALUES
(3, 'IT', 'information and technology group', 'joel', '2024-08-28 16:06:21', '2024-08-28 16:06:21');


INSERT INTO `branches` (`id`, `slug`, `name`, `contact_person`, `address`, `email`, `phone_number`, `reg_number`, `created_by`, `createdAt`, `updatedAt`) VALUES
(4, 'asokwa-branch', 'Asokwa Branch', 'Acquah Osei Joel', 'CQ84 Algiers ST, AK-196-2248', 'oseijoel6111@gmail.com', '0206036178', 'R00002', ' ', '2024-08-28 16:05:50', '2024-10-18 15:01:59'),
(5, 'area-block', 'Area Block', 'Charles', 'AK-1234-23', 'cewudzie0@gmail.com', '0596508407', 'P912', ' ', '2024-10-17 12:06:27', '2024-10-17 12:06:27');



CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `fullname` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `private_email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `permissions` varchar(255) DEFAULT NULL,
  `branchId` int(11) NOT NULL,
  `userGroupId` int(11) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `fullname`, `email`, `private_email`, `password`, `permissions`, `branchId`, `userGroupId`, `createdAt`, `updatedAt`) VALUES
(13, 'microadmin', 'Aziz Yamin', 'admin@micro.com', 'admin@micro.com', '$2a$10$wlSY/ztBTB3dpxUxMH8OCOV5JNxAPLU1HPjEbBYmTKPJUbiWM9kqi', '[\"scanning\",\"archiving\",\"view-upload\",\"supervision-right\",\"email-notification\"]', 5, 3, '2024-11-05 12:00:29', '2024-11-05 12:00:29');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `private_email` (`private_email`),
  ADD KEY `branchId` (`branchId`),
  ADD KEY `userGroupId` (`userGroupId`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1129` FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `users_ibfk_1130` FOREIGN KEY (`userGroupId`) REFERENCES `archive_categories` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
