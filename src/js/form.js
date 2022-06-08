window.onload = function () {

    const form = document.getElementById('contact-form');
    const inputs = document.querySelectorAll('.form-input');
    const textArea = document.querySelector('.form-textarea');


    const expresions = {
        user: /^[a-zA-ZÀ-ÿ\s]{1,40}$/, // Letras y espacios, pueden llevar acentos.
        email: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/,
        subject: /^[a-zA-ZÀ-ÿ\s]{7,40}$/, // Letras y espacios, pueden llevar acentos.
        content: /^[a-zA-ZÀ-ÿ\s\W\d]{1,300}$/, // Letras y espacios, pueden llevar acentos.
    }

    const fields = {
        user: false,
        email: false,
        subject: false,
        content: false
    }

    const formValidation = (e) => {
        switch(e.target.name) {
            case "user" :
                checkField(expresions.user, e.target, 'user');
            break;
            case "email" :
                checkField(expresions.email, e.target, 'email');
            break;
            case "subject" :
                checkField(expresions.subject, e.target, 'subject');
            break;
            case "content" :
                checkContent(expresions.content, e.target);
            break;
        }
    }

    textArea.addEventListener('keyup', formValidation);
    textArea.addEventListener('blur', formValidation);
    
    inputs.forEach((input) => {
        input.addEventListener('keyup', formValidation);
        input.addEventListener('blur', formValidation);
    });

    const checkField = (expresion, input, field) => {
        if(expresion.test(input.value)) {
            document.getElementById(`group-${field}`).classList.add('form-group--correct');
            document.getElementById(`group-${field}`).classList.remove('form-group--incorrect');
            document.querySelector(`#group-${field} i`).classList.add('fa-check');
            document.querySelector(`#group-${field} i`).classList.remove('fa-times');
            document.querySelector(`#group-${field} .form-group--error`).classList.remove('form-group--error--active');
            fields[field] = true;
        } else {
            document.getElementById(`group-${field}`).classList.add('form-group--incorrect');
            document.getElementById(`group-${field}`).classList.remove('form-group--correct');
            document.querySelector(`#group-${field} i`).classList.add('fa-times');
            document.querySelector(`#group-${field} i`).classList.remove('fa-check');
            document.querySelector(`#group-${field} .form-group--error`).classList.add('form-group--error--active');
            fields[field] = false;
        }
    }

    const checkContent = (expresion,textArea) => {
        if(expresion.test(textArea.value)) {
            document.getElementById(`group-content`).classList.add('form-group--textarea-correct');
            document.getElementById(`group-content`).classList.remove('form-group--textarea-incorrect');
            document.querySelector(`#group-content .form-group--error`).classList.remove('form-group--error--active');
            fields.content = true;
        } else {
            document.getElementById(`group-content`).classList.remove('form-group--textarea-correct');
            document.getElementById(`group-content`).classList.add('form-group--textarea-incorrect');
            document.querySelector(`#group-content .form-group--error`).classList.add('form-group--error--active');
            fields.content = false;
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        console.log(fields);

        if(fields.user && fields.email && fields.subject && fields.content ) {

            emailjs.sendForm('service_l49xl0j', 'template_qwccze9', form, "UZdTzitkN7lOw9igx")
            .then(function () {
                console.log('SUCCESS!');
            }, function (error) {
                console.log('FAILED...', error);
            });

            form.reset();

            document.getElementById('form-message').classList.add('form-message--correct-active');
            document.querySelector('#form-message .form-group--success').classList.toggle('show');
            document.getElementById('form-btn').disabled = true;
            setTimeout(() => {
                document.getElementById('form-message').classList.remove('form-message--correct-active');
                document.querySelector('#form-message .form-group--success').classList.toggle('show');
                document.getElementById('form-btn').disabled = false;
            }, 3000);

        } else {
            document.getElementById('form-message').classList.add('form-message--incorrect-active');
            document.querySelector('#form-message .form-group--error').classList.toggle('show');
            document.getElementById('form-btn').disabled = true;
            setTimeout(() => {
                document.getElementById('form-message').classList.remove('form-message--incorrect-active');
                document.querySelector('#form-message .form-group--error').classList.toggle('show');
                document.getElementById('form-btn').disabled = false;
            }, 3000);
        }
    })

}