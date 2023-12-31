import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import mysql from "mysql2";
import session from "express-session";
import { render } from "ejs";


const app = express();
const PORT = 5000;
// var customer;
// var car;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: '123456789nnn',
    resave: false,
    saveUninitialized: false
}));

// Database connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'cars_system',
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
    }
    console.log('Connected to MySQL as id ' + connection.threadId);
});
app.set('view engine', 'ejs');

// get request for home page
app.get("/", async (req, res) => {

    connection.query(`
      UPDATE cars c
      JOIN (
          SELECT CarID,
                 CASE 
                     WHEN ReturnDate < CURDATE() THEN 'Active' 
                     ELSE 'Reserved' 
                 END AS new_status
          FROM reservations
          WHERE ReturnDate < CURDATE()
      ) r ON c.CarID = r.CarID
      SET c.Status = r.new_status;
    `, (error, results) => {
        if (error) {
            console.error('Error executing SQL query:', error);
            return res.status(500).send('Internal Server Error');
        }


        res.render("home.ejs");
    });

});

app.get('/login', (req, res) => {
    res.render('login');
});


//Login post request
app.post('/login', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    // Query the database for the user
    connection.query(
        'SELECT * FROM customers WHERE Email = ?',
        [email],
        (err, users) => {

            if (err) {
                res.status(500).send('Error during login');
                return;
            }

            if (users.length === 0) {
                // User not found
                res.render('login.ejs', { error: 'Invalid email or password' });
                return;
            }

            const user = users[0];
            const passCheck = bcrypt.compareSync(password, user.pass);

            if (passCheck) {
                req.session.customer = user;
                if (user.isAdmin) {
                    req.session.role = 'admin';
                    res.redirect('/admin-dashboard');
                } else {
                    req.session.role = 'customer';
                    res.redirect('/dashboard');
                }
                return;
            } else {
                res.status(401).send('Invalid username or password');
            }

        });




});

// register get request 
app.get('/register', (req, res) => {
    res.render('register.ejs');
});


app.post('/register', (req, res) => {  // Needed : check for email or pass validations & check if the username is already exists
    const { firstName, lastName, email, phone, address, password } = req.body;

    // Password encryption
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    // Insert the new user into the database
    connection.query(
        'INSERT INTO customers (FirstName, LastName, Email, Phone, Address, pass) VALUES (?, ?, ?, ?, ?, ?)',
        [firstName, lastName, email, phone, address, hashedPassword],
        (err, results) => {
            if (err) {
                return res.status(500).render('register.ejs', { error: 'Account already exists!' });
            }
            // redirect to login page
            res.redirect('/login');
        });
});


app.get('/myreservations', (req, res) => {
    const selectedCustomerId = req.session.customer.CustomerID;

    connection.query(
        'SELECT * FROM reservations WHERE CustomerID = ?',
        [selectedCustomerId],
        (err, reservations) => {
            if (err) {
                console.error('Error fetching customer reservation details:', err);
                res.status(500).send('Error fetching customer reservation details');
                return;
            }

            // Extract all CarIDs from the reservations to fetch car details
            const carIds = reservations.map(reservation => reservation.CarID);

            connection.query(
                'SELECT * FROM cars WHERE CarID IN (?)',
                [carIds],
                (err, cars) => {
                    if (err) {
                        console.error('Error fetching car details:', err);
                        res.status(500).send('Error fetching car details');
                        return;
                    }


                    const renders = {
                        customerDetails: req.session.customer,
                        reservations: reservations,
                        cars: cars
                    };

                    res.render('myreservations.ejs', renders);
                }
            );
        }
    );
});








app.get('/reservation', (req, res) => {
    const selectedCarId = req.query.CarID;
    const reservationDate = new Date().toLocaleDateString(); // Assuming it to the current date

    // Fetch car and associated office details 
    connection.query(
        'SELECT c.*, o.location FROM cars c JOIN offices o ON c.office_id = o.office_id WHERE c.CarID = ?',
        [selectedCarId],
        (err, results) => {
            const selectedCar = results[0];
            if (err || !selectedCar) {
                console.error('Error fetching car details:', err);
                res.status(500).send('Error fetching car details');
                return;
            }

            req.session.car = selectedCar;
            const customer = req.session.customer;
            const renders = {
                customerDetails: customer,
                selectedCar: selectedCar,
                reservationDate: reservationDate
            };

            res.render('reservation.ejs', renders);
        });
});





app.post('/reservation', (req, res) => {
    const selectedCustomerId = req.session.customer.CustomerID;
    const selectedCarId = req.session.car.CarID;
    const pickupDate = req.body.pickupDate;
    const returnDate = req.body.returnDate;
    const status = 'Reserved';
    const totalprice = req.body.totalprice;
    const payment_method = req.body.payment_method;



    // // Save the reservation to the database
    connection.query(
        'INSERT INTO Reservations (CustomerID, CarID, ReservationDate, PickupDate, ReturnDate,totalprice,payment_method) VALUES (?, ?, CURDATE(), ?, ?,?,?)',
        [selectedCustomerId, selectedCarId, pickupDate, returnDate, totalprice, payment_method],
        (err, results) => {
            if (err) {
                console.error('Error reserving car:', err);
                res.status(500).send('Error reserving car');
                return;
            }

            // Update the car's status to 'Reserved'
            connection.query(
                'UPDATE cars SET Status = ? WHERE CarID = ?',
                [status, selectedCarId],
                (err) => {
                    if (err) {
                        console.error('Error updating car status:', err);
                        res.status(500).send('Error updating car status');
                        return;
                    }
                    // Redirect to dashboard after successful reservation and status update
                    res.redirect('/dashboard');
                });
        });
});








app.get('/office-details', (req, res) => {
    const carID = req.query.CarID;


    connection.query('SELECT o.location, o.contact_info FROM cars c JOIN offices o ON c.office_id = o.office_id WHERE c.CarID = ?', [carID], (err, results) => {
        if (err) {
            console.error('Error fetching office details:', err);
            res.status(500).send('Error fetching office details');
            return;
        }

        if (results.length === 0) {
            res.status(404).send('Office details not found');
            return;
        }

        const officeDetails = results[0];

        res.render('office-details.ejs', { officeDetails });
    });
});


app.post('/filter', (req, res) => {
    const customer = req.session.customer;
    const yearFilter = req.body.year || [];
    const minPrice = req.body.minPrice;
    const maxPrice = req.body.maxPrice;
    // req.session.selectedYears = yearFilter;
    let query = 'SELECT * FROM `cars` WHERE 1';

    const queryParams = [];


    if (yearFilter && yearFilter.length > 0) {
        query += ' AND cars.Year IN (?)';
        queryParams.push(yearFilter);
    }


    if (minPrice && maxPrice) {
        query += ' AND cars.unitprice BETWEEN ? AND ?';
        queryParams.push(minPrice, maxPrice);
    }

    connection.query(query, queryParams, (err, cars) => {
        if (err) {
            res.status(500).send('Error loading cars');
            return;
        }
        const renders = {
            customerDetails: customer,
            carsList: cars,
            selectedYears: yearFilter,
            selected_minPrice: minPrice,
            selected_maxPrice: maxPrice,
            error: "No available cars"
        }
        res.render('welcome.ejs', renders);
    });
});




app.get('/dashboard', (req, res) => {
    const customer = req.session.customer;
    const yearFilter = req.body.year || [];
    const minPrice = req.body.minPrice;
    const maxPrice = req.body.maxPrice;
    connection.query(
        'SELECT * FROM cars',
        (err, cars) => {
            if (err) {
                res.status(500).send('Error during login');
                return;
            }
            const renders = {
                customerDetails: customer,
                carsList: cars,
                selectedYears: yearFilter,
                selected_minPrice: minPrice,
                selected_maxPrice: maxPrice,
                error: "No available cars"
            }
            res.render('welcome.ejs', renders);
        });
});

app.get('/about-us', (req, res) => {
    res.render('about-us');
});

app.get('/contact', (req, res) => {
    res.render('contact');
});

// admin routes
const isAdmin = (req, res, next) => {
    if (!req.session || !req.session.role || req.session.role !== 'admin') {
        return res.status(403).send('Admin access required');
    }
    next();
};

app.get('/admin-dashboard', isAdmin, (req, res) => {
    connection.query('SELECT * FROM cars', (err, cars) => {
        if (err) {
            res.status(500).send('Error fetching cars');
            return;
        }

        const renders = {
            carsList: cars
        };

        res.render('admin-dashboard.ejs', renders);
    });
});



app.post('/update-status', (req, res) => {
    const carID = req.body.CarID;
    const newStatus = req.body.status;


    if (newStatus === "Reserved") {
        connection.query(
            'DELETE FROM reservations WHERE CarID = ?',
            [carID],
            (err, results) => {
                if (err) {
                    console.error('Error removing reservation:', err);
                    res.status(500).send('Error updating status');
                    return;
                }

                updateCarStatus(res, carID, newStatus);
            }
        );
    } else {

        updateCarStatus(res, carID, newStatus);
    }
});



function updateCarStatus(res, carID, newStatus) {
    connection.query(
        'UPDATE cars SET Status = ? WHERE CarID = ?',
        [newStatus, carID],
        (err) => {
            if (err) {
                console.error('Error updating car status:', err);
                res.status(500).send('Error updating status');
                return;
            }
            res.redirect('/admin-dashboard');
        }
    );
}


app.post('/remove-car', (req, res) => {
    const carID = req.body.CarID;

   
    connection.query('DELETE FROM cars WHERE CarID = ?', [carID], (err, results) => {
        if (err) {
            console.error('Error removing car:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

   
        res.redirect('/admin-dashboard');    
    });
});


app.get('/admin-search-form', (req, res) => {
    res.render('admin-search-form');
});

app.post('/adminsearch', (req, res) => {
    const carID = req.body.carID;
    const lastName = req.body.lastName;
    const reservationDate = req.body.reservationDate;
    console.log(reservationDate);


    let query = `
    SELECT cars.*, offices.* , customers.*, reservations.* 
    FROM cars 
    LEFT JOIN reservations ON cars.CarID = reservations.CarID 
    LEFT JOIN customers ON reservations.CustomerID = customers.CustomerID
    JOIN offices ON cars.office_id=offices.office_id 
    WHERE 1=1
`;

    const queryParams = [];

    if (carID) {
        query += ' AND cars.CarID = ?';
        queryParams.push(carID);
    }

    if (lastName) {
        query += ' AND customers.LastName LIKE ?';
        queryParams.push(`%${lastName}%`);
    }

    if (reservationDate) {
        query += ' AND reservations.ReservationDate = ?';
        queryParams.push(reservationDate);
    }


    connection.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error executing search query:', err);
            res.status(500).send('Error searching');
            return;
        }


        res.render('admin-search-results.ejs', { searchResults: results });
    });
});



app.get('/admin-Register-car', isAdmin, (req, res) => {
    connection.query(
        'SELECT * FROM offices',
        (err, offices) => {
            if (err) {
                console.error('Error fetching offices:', err);
                res.status(500).send('Error fetching offices');
                return;
            }
            res.render('admin-Register-car.ejs', { offices });
        }
    );
});


app.post('/admin-Register-car', isAdmin, (req, res) => {
    const { model, year, plateid, status, unitprice, officeid } = req.body;


    connection.query(
        'INSERT INTO cars (Model, Year, PlateID, Status, unitprice,office_id) VALUES (?, ?, ?, ?, ?, ?)',
        [model, year, plateid, status, unitprice, officeid],
        (err, results) => {
            if (err) {
                console.error('Error registering new car:', err);
                res.status(500).send('Error registering new car');
                return;
            }


            res.redirect('/admin-dashboard');
        }
    );
});


app.get('/admin-reports', (req, res) => {
    res.render('admin-reports.ejs');
});


app.post('/report1', (req, res) => {
    const pickupDate = req.body.pickupDate
    const returnDate = req.body.returnDate;

    let query = `
    SELECT c.*, cs.*, r.*
    FROM reservations AS r 
    JOIN cars AS c ON r.CarID = c.CarID
    JOIN customers AS cs ON r.CustomerID = cs.CustomerID
    WHERE 1=1
`;



    const queryParams = [];
    if (pickupDate) {
        query += 'AND r.PickupDate >=  ?';
        queryParams.push(pickupDate);
    }
    if (returnDate) {
        query += 'AND r.ReturnDate <=  ?';
        queryParams.push(returnDate);
    }

    connection.query(query, queryParams, (err, results) => {
        console.log(results);
        if (err) {
            console.error('Error executing search query:', err);
            res.status(500).send('Error fetching reports');
            return;
        }

        const renders = {
            reports: results,
            reportID: 1
        }
        res.render('admin-reports.ejs', renders);
    });

});

app.post('/report2', (req, res) => {
    const pickupDate = req.body.pickupDate
    const returnDate = req.body.returnDate;

    let query = `
    SELECT c.*, r.*
    FROM reservations AS r 
    JOIN cars AS c ON r.CarID = c.CarID
    WHERE 1
`;



    const queryParams = [];
    if (pickupDate) {
        query += 'AND r.PickupDate >=  ?';
        queryParams.push(pickupDate);
    }
    if (returnDate) {
        query += 'AND r.ReturnDate <=  ?';
        queryParams.push(returnDate);
    }

    connection.query(query, queryParams, (err, results) => {
        console.log(results);
        if (err) {
            console.error('Error executing search query:', err);
            res.status(500).send('Error fetching reports');
            return;
        }

        const renders = {
            reports: results,
            reportID: 2
        }
        res.render('admin-reports.ejs', renders);
    });

});

app.post('/report3', (req, res) => {
    const specificDate = req.body.specificDate;

    let query = `
        SELECT c.*, 
        CASE 
            WHEN r.ReservationDate <= ? AND r.ReturnDate >= ? THEN 'Reserved'
            WHEN c.status = 'Reserved' or 'reserved' THEN 'Active'
            ELSE c.status
        END AS carStatus
        FROM cars c
        LEFT JOIN reservations r ON c.carID = r.carID
    `;

    const queryParams = [specificDate, specificDate];

    if (!specificDate) {
        // If specificDate is not provided, handle the error or send an appropriate response
        res.status(400).send('Specific date is required');
        return;
    }

    connection.query(query, queryParams, (err, results) => {
        console.log(results);
        if (err) {
            console.error('Error executing search query:', err);
            res.status(500).send('Error fetching reports');
            return;
        }

        const renders = {
            reports: results,
            reportID: 3
        }
        res.render('admin-reports.ejs', renders);
    });
});


app.post('/report4', (req, res) => {
    const customerID = req.body.customerID;

    var query = `
    SELECT r.*, cs.*, c.Model, c.PlateID 
    FROM reservations AS r 
    JOIN customers AS cs ON r.CustomerID = cs.CustomerID
    JOIN cars as c ON r.CarID = c.CarID
    WHERE 1
    `;

    const queryParams = [];
    if (customerID) {
        query += ' AND r.CustomerID = ?';
        queryParams.push(customerID);
    }

    connection.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error executing search query:', err);
            res.status(500).send('Error fetching reports');
            return;
        }
        const renders = {
            reports: results,
            reportID: 4
        }
        res.render('admin-reports.ejs', renders);
    });
});

app.post('/report5', (req, res) => {
    const pickupDate = req.body.pickupDate
    const returnDate = req.body.returnDate;

    let query = `
    SELECT r.*
    FROM reservations AS r
    WHERE 1=1
`;



    const queryParams = [];
    if (pickupDate) {
        query += 'AND r.PickupDate >=  ?';
        queryParams.push(pickupDate);
    }
    if (returnDate) {
        query += 'AND r.ReturnDate <=  ?';
        queryParams.push(returnDate);
    }

    connection.query(query, queryParams, (err, results) => {
        console.log(results);
        if (err) {
            console.error('Error executing search query:', err);
            res.status(500).send('Error fetching reports');
            return;
        }

        const renders = {
            reports: results,
            reportID: 5
        }
        res.render('admin-reports.ejs', renders);
    });

});


app.get('/logout', (req, res) => {
    res.render('login');
});


app.post('/logout', (req, res) => {

    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            res.status(500).send('Server error');
            return;
        }

        res.redirect('/login');
    });
});



app.listen(PORT, () => {
    console.log(`Server is running on port : ${PORT}`);
});
