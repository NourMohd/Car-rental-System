CREATE TABLE Customer (
    ssn VARCHAR(15) PRIMARY KEY AUTO_INCREMENT,
    fname VARCHAR(50),
    lname VARCHAR(50),
    gender CHAR(1),
    address VARCHAR(255),
    phonenumber VARCHAR(15) UNIQUE
);

CREATE TABLE Reservation (
    Reservation_no INT PRIMARY KEY AUTO_INCREMENT,
    reserve_date DATE,
    pickup_date DATE,
    return_date DATE
);

CREATE TABLE Payment (
    pay_date DATE PRIMARY KEY,
    Reservation_no INT,
    paymethod VARCHAR(50),
    FOREIGN KEY (Reservation_no) REFERENCES Reservation(Reservation_no),
    PRIMARY KEY(pay_date,Reservation_no)
);

CREATE TABLE Creditcard (
    number VARCHAR(16) PRIMARY KEY,
    holder_name VARCHAR(100),
    CVV VARCHAR(4),
    expire_date DATE
);

CREATE TABLE Car (
    plate_id VARCHAR(15) PRIMARY KEY,
    status VARCHAR(15) CHECK (status IN ('active', 'out of service')),
    year INT,
    model VARCHAR(50),
    price_per_day DECIMAL(10, 2),
    office_id INT,
    Reservation_no INT,
    FOREIGN KEY (office_id) REFERENCES Office(office_id),
    FOREIGN KEY (Reservation_no) REFERENCES Reservation(Reservation_no)
);

CREATE TABLE Offices (
    office_id INT PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    phonenumber VARCHAR(15) UNIQUE,
    region VARCHAR(50),
    city VARCHAR(50),
    country VARCHAR(50)
);