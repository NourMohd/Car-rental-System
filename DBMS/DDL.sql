CREATE TABLE Offices (
    office_id INT AUTO_INCREMENT PRIMARY KEY,
    location varchar(255) not null,
     contact_info VARCHAR(255) not null

);
CREATE TABLE Customers (
    CustomerID INT PRIMARY KEY AUTO_INCREMENT,
    FirstName VARCHAR(50),
    LastName VARCHAR(50),
    Address VARCHAR(255),
    Phone VARCHAR(20) UNIQUE,
    pass varchar(255),
    Email VARCHAR(255) UNIQUE,
    isAdmin Boolean default false
);

CREATE TABLE Reservations(
    ReservationID INT AUTO_INCREMENT PRIMARY KEY,
    ReservationDate DATE,
    PickupDate DATE,
    ReturnDate DATE,
    CustomerID INT,
    Status VARCHAR(255),
    totalprice DECIMAL,
    payment_method VARCHAR(255) NOT NULL,
    FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID)

);

CREATE TABLE Payments (
    PaymentDate DATE,
    ReservationID INT,
    paymethod VARCHAR(50),
    PRIMARY KEY (ReservationID,PaymentDate),
    FOREIGN KEY (ReservationID) REFERENCES Reservations(ReservationID)
);


CREATE TABLE Cars (
        CarID INT AUTO_INCREMENT PRIMARY KEY,
    PlateID VARCHAR(20),
    Status VARCHAR(20),
    Year INT,
    Model VARCHAR(255),
    unitprice int,
    office_id INT,
    ReservationID INT,
    FOREIGN KEY (office_id) REFERENCES Offices(office_id),
    FOREIGN KEY (ReservationID) REFERENCES Reservations(ReservationID)
);

